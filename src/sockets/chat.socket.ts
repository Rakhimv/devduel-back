import { Server, Socket } from "socket.io";
import { verify } from "jsonwebtoken";
import { getUnreadCount, saveMessageToDB } from "../services/chat.service";
import { getAllUsers, getUserById } from "../services/user.service";
import { pool } from "../config/db";
import { v4 as uuidv4 } from "uuid";

interface GameSession {
  id: string;
  player1: {
    id: number;
    username: string;
    avatar?: string | null;
    isReady: boolean;
  };
  player2: {
    id: number;
    username: string;
    avatar?: string | null;
    isReady: boolean;
  };
  status: 'waiting' | 'ready' | 'in_progress' | 'finished' | 'abandoned';
  duration: number;
  timeRemaining: number;
  startTime: string;
  gameResult?: 'timeout' | 'player_left' | 'completed' | 'finished';
  winner?: {
    id: number;
    username: string;
  };
}

interface User {
  id: number;
  email: string;
  login: string;
}

declare module "socket.io" {
  interface SocketData {
    user: User;
    currentChatId?: string;
    currentGameSession?: string;
  }
}

const gameSessions = new Map<string, GameSession>();
const gameInvites = new Map<string, any>();

let globalIo: Server | null = null;

export const emitGameProgressUpdate = async (gameId: string) => {
  const session = gameSessions.get(gameId);
  if (!session || !globalIo) return;

  try {
    // Get progress for both players
    const gameResult = await pool.query(
      "SELECT player1_id, player2_id FROM games WHERE id = $1",
      [gameId]
    );

    if (gameResult.rows.length === 0) return;

    const game = gameResult.rows[0];
    
    // Get progress for player1
    const p1ProgressRes = await pool.query(
      "SELECT task_id FROM game_task_completions WHERE game_id = $1 AND player_id = $2",
      [gameId, game.player1_id]
    );
    const p1Level = p1ProgressRes.rows.length + 1;

    // Get progress for player2
    const p2ProgressRes = await pool.query(
      "SELECT task_id FROM game_task_completions WHERE game_id = $1 AND player_id = $2",
      [gameId, game.player2_id]
    );
    const p2Level = p2ProgressRes.rows.length + 1;

    // Emit progress update to both players
    globalIo.to(`user_${game.player1_id}`).emit("game_progress_update", {
      playerLevel: p1Level,
      opponentLevel: p2Level
    });

    globalIo.to(`user_${game.player2_id}`).emit("game_progress_update", {
      playerLevel: p2Level,
      opponentLevel: p1Level
    });
  } catch (error) {
    console.error("Error emitting game progress update:", error);
  }
};

export const finishGame = async (gameId: string, reason: 'finished' | 'player_left' | 'timeout' = 'finished', winnerId?: number | null) => {
  const session = gameSessions.get(gameId);
  if (!session) {
    // Try to get from DB
    try {
      const result = await pool.query(
        "SELECT id, player1_id, player2_id, status, duration_ms, winner_id, start_time FROM games WHERE id = $1",
        [gameId]
      );
      
      if (result.rows.length > 0 && result.rows[0].status !== 'finished' && result.rows[0].status !== 'abandoned') {
        const row = result.rows[0];
        const finalWinnerId = winnerId !== undefined ? winnerId : row.winner_id;
        
        const finalStatus = reason === 'player_left' ? 'abandoned' : 'finished';
        await pool.query(
          "UPDATE games SET status = $1, end_time = NOW() WHERE id = $2",
          [finalStatus, gameId]
        );

        // Only increment game stats if game is finished (not abandoned)
        if (finalStatus === 'finished') {
          // Increment games_count for both players
          await pool.query(
            "UPDATE users SET games_count = COALESCE(games_count, 0) + 1 WHERE id IN (SELECT player1_id FROM games WHERE id = $1 UNION SELECT player2_id FROM games WHERE id = $1)",
            [gameId]
          );

          // Increment wins_count only for the winner
          if (finalWinnerId) {
            await pool.query(
              "UPDATE users SET wins_count = COALESCE(wins_count, 0) + 1 WHERE id = $1",
              [finalWinnerId]
            );
          }
        }

        if (globalIo) {
          // Emit final progress update before ending game
          await emitGameProgressUpdate(gameId);
          
          // Delay to ensure progress update animation has time to play (1 second for animation + buffer)
          await new Promise(resolve => setTimeout(resolve, 1200));
          
          // Get winner info if exists
          let winnerInfo = null;
          if (finalWinnerId) {
            const winnerRes = await pool.query("SELECT id, login FROM users WHERE id = $1", [finalWinnerId]);
            if (winnerRes.rows.length > 0) {
              winnerInfo = {
                id: winnerRes.rows[0].id,
                username: winnerRes.rows[0].login
              };
            }
          }

          // Build final session data
          const player1Res = await pool.query("SELECT login, avatar FROM users WHERE id = $1", [row.player1_id]);
          const player2Res = await pool.query("SELECT login, avatar FROM users WHERE id = $1", [row.player2_id]);

          // Calculate actual game duration from start_time to end_time
          let actualDuration = 0;
          if (row.start_time) {
            const startTime = new Date(row.start_time).getTime();
            const endTime = Date.now();
            actualDuration = Math.max(0, endTime - startTime);
          }

          const finalSession = {
            id: gameId,
            player1: {
              id: row.player1_id,
              username: player1Res.rows[0]?.login || 'Unknown',
              avatar: player1Res.rows[0]?.avatar || null,
              isReady: false
            },
            player2: {
              id: row.player2_id,
              username: player2Res.rows[0]?.login || 'Unknown',
              avatar: player2Res.rows[0]?.avatar || null,
              isReady: false
            },
            status: 'finished' as const,
            duration: actualDuration || 0,
            timeRemaining: 0,
            startTime: row.start_time || new Date().toISOString(),
            gameResult: reason === 'player_left' ? 'player_left' : reason === 'timeout' ? 'timeout' : 'completed',
            winner: winnerInfo
          };

          globalIo.to(`user_${row.player1_id}`).emit("game_session_end", finalSession);
          globalIo.to(`user_${row.player2_id}`).emit("game_session_end", finalSession);
          
          // Additional delay before returning to ensure both players received the event
          await new Promise(resolve => setTimeout(resolve, 200));

          const chatParticipantsRes = await pool.query(
            "SELECT DISTINCT chat_id FROM chat_participants WHERE user_id = ANY($1)",
            [[row.player1_id, row.player2_id]]
          );

          for (const chat of chatParticipantsRes.rows) {
            // Calculate actual duration for notification
            let notificationDuration = actualDuration || 0;
            if (!actualDuration && row.start_time) {
              const startTime = new Date(row.start_time).getTime();
              const endTime = Date.now();
              notificationDuration = Math.max(0, endTime - startTime);
            }
            
            globalIo.to(chat.chat_id).emit("game_end_notification", {
              reason,
              duration: notificationDuration
            });
          }
        }
      }
    } catch (error) {
      console.error("Error finishing game from DB:", error);
    }
    return;
  }

  // Update session status before deletion
  session.status = 'finished';
  session.timeRemaining = 0;
  session.gameResult = reason === 'player_left' ? 'player_left' : reason === 'timeout' ? 'timeout' : 'completed';

  // Get winner info if provided
  if (winnerId) {
    try {
      const winnerRes = await pool.query("SELECT id, login FROM users WHERE id = $1", [winnerId]);
      if (winnerRes.rows.length > 0) {
        if (session.player1.id === winnerId) {
          session.winner = { id: session.player1.id, username: session.player1.username };
        } else if (session.player2.id === winnerId) {
          session.winner = { id: session.player2.id, username: session.player2.username };
        }
      }
    } catch (error) {
      console.error("Error getting winner info:", error);
    }
  } else {
    // Try to get winner from DB
    try {
      const gameResult = await pool.query("SELECT winner_id FROM games WHERE id = $1", [gameId]);
      if (gameResult.rows.length > 0 && gameResult.rows[0].winner_id) {
        const dbWinnerId = gameResult.rows[0].winner_id;
        if (session.player1.id === dbWinnerId) {
          session.winner = { id: session.player1.id, username: session.player1.username };
        } else if (session.player2.id === dbWinnerId) {
          session.winner = { id: session.player2.id, username: session.player2.username };
        }
      }
    } catch (error) {
      console.error("Error getting winner from DB:", error);
    }
  }

  // Calculate actual game duration from start_time
  let actualDuration = 0;
  if (session.startTime) {
    const startTime = new Date(session.startTime).getTime();
    const endTime = Date.now();
    actualDuration = Math.max(0, endTime - startTime);
  }

  try {
    const finalStatus = reason === 'player_left' ? 'abandoned' : 'finished';
    await pool.query(
      "UPDATE games SET status = $1, end_time = NOW() WHERE id = $2",
      [finalStatus, gameId]
    );

    // Only increment game stats if game is finished (not abandoned)
    if (finalStatus === 'finished') {
      // Increment games_count for both players
      await pool.query(
        "UPDATE users SET games_count = COALESCE(games_count, 0) + 1 WHERE id IN (SELECT player1_id FROM games WHERE id = $1 UNION SELECT player2_id FROM games WHERE id = $1)",
        [gameId]
      );

      // Increment wins_count only for the winner
      if (winnerId) {
        await pool.query(
          "UPDATE users SET wins_count = COALESCE(wins_count, 0) + 1 WHERE id = $1",
          [winnerId]
        );
      }
    }
  } catch (error) {
    console.error("Error updating game status:", error);
  }

  if (globalIo) {
    // Emit final progress update before ending game
    await emitGameProgressUpdate(gameId);
    
    // Delay to ensure progress update animation has time to play (1 second for animation + buffer)
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Send final session with winner info - make sure it has all required fields
    const finalSession = {
      ...session,
      id: session.id,
      status: 'finished' as const,
      duration: actualDuration || session.duration,
      timeRemaining: 0
    };
    
    globalIo.to(`user_${session.player1.id}`).emit("game_session_end", finalSession);
    globalIo.to(`user_${session.player2.id}`).emit("game_session_end", finalSession);

    // Additional delay before deleting to ensure both players received the event
    await new Promise(resolve => setTimeout(resolve, 200));

    const chatParticipantsRes = await pool.query(
      "SELECT DISTINCT chat_id FROM chat_participants WHERE user_id = ANY($1)",
      [[session.player1.id, session.player2.id]]
    );

    for (const chat of chatParticipantsRes.rows) {
      globalIo.to(chat.chat_id).emit("game_end_notification", {
        reason,
        duration: actualDuration || session.duration
      });

      const updateRes = await pool.query(
        "UPDATE messages SET game_invite_data = jsonb_set(game_invite_data, '{status}', '\"abandoned\"') WHERE game_invite_data->>'from_user_id' = ANY($1) AND game_invite_data->>'status' = '\"accepted\"' AND chat_id = $2 RETURNING game_invite_data->>'invite_id' as invite_id",
        [[session.player1.id, session.player2.id], chat.chat_id]
      );

      for (const row of updateRes.rows) {
        if (row.invite_id) {
          globalIo.to(chat.chat_id).emit("game_invite_abandoned", { inviteId: row.invite_id });
        }
      }
    }
  }

  // Delete session after ensuring both players received the final update
  // Add small delay to ensure socket events are delivered
  setTimeout(() => {
    gameSessions.delete(gameId);
  }, 500);
};

async function loadActiveGameSessions() {
  try {
    const result = await pool.query(
      "SELECT id, player1_id, player2_id, player1_ready, player2_ready, status, start_time, duration_ms FROM games WHERE status IN ('waiting', 'ready', 'in_progress')"
    );

    for (const row of result.rows) {
      const player1Res = await pool.query("SELECT login, avatar FROM users WHERE id = $1", [row.player1_id]);
      const player2Res = await pool.query("SELECT login, avatar FROM users WHERE id = $1", [row.player2_id]);
      
      console.log('Player1 avatar from DB:', player1Res.rows[0]?.avatar);
      console.log('Player2 avatar from DB:', player2Res.rows[0]?.avatar);

      const session: GameSession = {
        id: row.id,
        player1: {
          id: row.player1_id,
          username: player1Res.rows[0]?.login || 'Unknown',
          avatar: player1Res.rows[0]?.avatar || null,
          isReady: row.player1_ready
        },
        player2: {
          id: row.player2_id,
          username: player2Res.rows[0]?.login || 'Unknown',
          avatar: player2Res.rows[0]?.avatar || null,
          isReady: row.player2_ready
        },
        status: row.status as GameSession['status'],
        duration: row.duration_ms,
        timeRemaining: row.duration_ms,
        startTime: row.start_time || new Date().toISOString()
      };

      gameSessions.set(row.id, session);
      console.log(`Loaded active game session: ${row.id}`);
    }
  } catch (error) {
    console.error("Error loading active game sessions:", error);
  }
}

export const initChatSocket = async (io: Server) => {
  globalIo = io;
  await loadActiveGameSessions();

  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.headers.cookie
      ?.split("; ")
      .find((row) => row.startsWith("token="))
      ?.split("=")[1];

    if (!token) return next(new Error("Authentication error: No token provided"));

    try {
      const decoded = verify(token, process.env.SECRET || "") as User;
      socket.data.user = decoded;

      await pool.query("UPDATE users SET is_online = TRUE WHERE id = $1", [decoded.id]);
      io.emit("user_status", { userId: decoded.id, isOnline: true });

      next();
    } catch {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    console.log(`User connected: ${socket.data.user.id}`);
    
    socket.join(`user_${socket.data.user.id}`);
    console.log(`User ${socket.data.user.id} joined room user_${socket.data.user.id}`);
    
    // Emit updated general chat participant count
    const updateGeneralChatCount = async () => {
      const totalCountRes = await pool.query("SELECT COUNT(*) as total FROM users");
      const onlineCountRes = await pool.query("SELECT COUNT(*) as online FROM users WHERE is_online = TRUE");
      io.to('general').emit("general_chat_update", {
        participantsCount: parseInt(totalCountRes.rows[0].total),
        onlineCount: parseInt(onlineCountRes.rows[0].online)
      });
    };
    updateGeneralChatCount();

    socket.on("join_chat", async (chatId: string) => {
      if (!chatId) return;
      
   
      if (socket.data.currentChatId) {
        socket.leave(socket.data.currentChatId);
      }
      
      socket.join(chatId);
      socket.data.currentChatId = chatId;
      
      // If joining general chat, emit updated counts
      if (chatId === 'general') {
        const totalCountRes = await pool.query("SELECT COUNT(*) as total FROM users");
        const onlineCountRes = await pool.query("SELECT COUNT(*) as online FROM users WHERE is_online = TRUE");
        socket.emit("general_chat_update", {
          participantsCount: parseInt(totalCountRes.rows[0].total),
          onlineCount: parseInt(onlineCountRes.rows[0].online)
        });
      }
    });

    socket.on("leave_chat", (chatId: string) => {
      if (chatId) {
        socket.leave(chatId);
        if (socket.data.currentChatId === chatId) {
          socket.data.currentChatId = undefined;
        }
      }
    });

    socket.on("send_message", async ({ chatId, text }: { chatId: string; text: string }) => {
      if (!chatId || !text.trim()) return;

      const message = await saveMessageToDB({
        chatId,
        userId: socket.data.user.id,
        text,
        timestamp: new Date(),
      });

      io.to(chatId).emit("new_message", {
        id: message.id,
        user_id: socket.data.user.id,
        username: socket.data.user.login,
        text,
        timestamp: message.timestamp,
        is_read: false,
      });

      if (chatId === 'general') {
        const allUsers = await pool.query("SELECT id FROM users WHERE is_online = TRUE");
        for (const user of allUsers.rows) {
          const unread_count = await getUnreadCount(chatId, user.id);
          io.to(`user_${user.id}`).emit("chat_update", {
            chatId,
            last_message: text,
            last_timestamp: message.timestamp,
            unread_count,
          });
        }
      } else {
        const participants = await pool.query(
          "SELECT user_id FROM chat_participants WHERE chat_id = $1",
          [chatId]
        );
        for (const participant of participants.rows) {
          const unread_count = await getUnreadCount(chatId, participant.user_id);
          io.to(`user_${participant.user_id}`).emit("chat_update", {
            chatId,
            last_message: text,
            last_timestamp: message.timestamp,
            unread_count,
          });
        }
      }
    });


    socket.on("remove_previous_invites", async ({ chatId, toUserId }) => {
      try {
        for (const [inviteId, invite] of gameInvites.entries()) {
          if (invite.fromUserId === socket.data.user.id && invite.toUserId === toUserId && invite.status === 'pending') {
            gameInvites.delete(inviteId);
            
            await pool.query(
              "UPDATE messages SET game_invite_data = jsonb_set(game_invite_data, '{status}', '\"expired\"') WHERE game_invite_data->>'invite_id' = $1",
              [inviteId]
            );
            
            if (chatId) {
              io.to(chatId).emit("game_invite_expired", { inviteId });
            }
            
            io.to(`user_${toUserId}`).emit("game_invite_expired", { inviteId });
          }
        }
      } catch (error) {
        console.error("Error removing previous invites:", error);
      }
    });

    socket.on("send_game_invite", async ({ chatId, toUserId }) => {
      try {
        for (const [existingInviteId, existingInvite] of gameInvites.entries()) {
          if (existingInvite.fromUserId === socket.data.user.id && 
              existingInvite.toUserId === toUserId && 
              existingInvite.status === 'pending') {
            gameInvites.delete(existingInviteId);
            
            await pool.query(
              "UPDATE messages SET game_invite_data = jsonb_set(game_invite_data, '{status}', '\"expired\"') WHERE game_invite_data->>'invite_id' = $1",
              [existingInviteId]
            );
            
            if (chatId) {
              io.to(chatId).emit("game_invite_expired", { inviteId: existingInviteId });
            }
            
            io.to(`user_${toUserId}`).emit("game_invite_expired", { inviteId: existingInviteId });
          }
        }

        let finalChatId = chatId;
        
        if (!chatId || chatId === 'null') {
          const existingChatRes = await pool.query(
            "SELECT id FROM chats WHERE privacy_type = 'private' AND id IN (SELECT chat_id FROM chat_participants WHERE user_id = ANY($1) GROUP BY chat_id HAVING COUNT(*) = 2)",
            [[socket.data.user.id, toUserId]]
          );
          
          if (existingChatRes.rows.length > 0) {
            finalChatId = existingChatRes.rows[0].id;
          } else {
            const chatId = uuidv4();
            const newChatRes = await pool.query(
              "INSERT INTO chats (id, privacy_type, chat_type) VALUES ($1, $2, $3) RETURNING id",
              [chatId, 'private', 'direct']
            );
            finalChatId = newChatRes.rows[0].id;
            
            await pool.query(
              "INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2), ($1, $3)",
              [finalChatId, socket.data.user.id, toUserId]
            );

            io.to(`user_${socket.data.user.id}`).emit("chat_created", { chatId: finalChatId });
            io.to(`user_${toUserId}`).emit("chat_created", { chatId: finalChatId });
          }
        }

        const inviteId = uuidv4();
        
        // Get avatars for both users
        const fromUserRes = await pool.query("SELECT login, avatar FROM users WHERE id = $1", [socket.data.user.id]);
        const toUserRes = await pool.query("SELECT login, avatar FROM users WHERE id = $1", [toUserId]);
        
        const fromUser = fromUserRes.rows[0];
        const toUser = toUserRes.rows[0];
        
        const invite = {
          id: inviteId,
          fromUserId: socket.data.user.id,
          fromUsername: fromUser?.login || socket.data.user.login,
          fromAvatar: fromUser?.avatar || null,
          toUserId,
          toUsername: toUser?.login || 'Unknown',
          toAvatar: toUser?.avatar || null,
          timestamp: new Date().toISOString(),
          status: 'pending'
        };

        gameInvites.set(inviteId, invite);

        const message = await saveMessageToDB({
          chatId: finalChatId,
          userId: socket.data.user.id,
          text: `🎮 Игровое приглашение от ${socket.data.user.login}`,
          timestamp: new Date(),
          messageType: 'game_invite',
          gameInviteData: {
            invite_id: inviteId,
            from_user_id: socket.data.user.id,
            from_username: fromUser?.login || socket.data.user.login,
            from_avatar: fromUser?.avatar || null,
            to_user_id: toUserId,
            to_username: toUser?.login || 'Unknown',
            to_avatar: toUser?.avatar || null,
            status: 'pending'
          }
        });

        io.to(finalChatId).emit("new_message", {
          id: message.id,
          user_id: socket.data.user.id,
          username: socket.data.user.login,
          text: message.text,
          timestamp: message.timestamp,
          is_read: false,
          message_type: 'game_invite',
          game_invite_data: {
            invite_id: inviteId,
            from_user_id: socket.data.user.id,
            from_username: fromUser?.login || socket.data.user.login,
            from_avatar: fromUser?.avatar || null,
            to_user_id: toUserId,
            to_username: toUser?.login || 'Unknown',
            to_avatar: toUser?.avatar || null,
            status: 'pending'
          }
        });

        // Handle chat update for general or private chats
        if (finalChatId === 'general') {
          const allUsers = await pool.query("SELECT id FROM users WHERE is_online = TRUE");
          for (const user of allUsers.rows) {
            const unread_count = await getUnreadCount(finalChatId, user.id);
            io.to(`user_${user.id}`).emit("chat_update", {
              chatId: finalChatId,
              last_message: message.text,
              last_timestamp: message.timestamp,
              unread_count,
            });
          }
        } else {
          const participants = await pool.query(
            "SELECT user_id FROM chat_participants WHERE chat_id = $1",
            [finalChatId]
          );
          
          for (const participant of participants.rows) {
            const unread_count = await getUnreadCount(finalChatId, participant.user_id);
            io.to(`user_${participant.user_id}`).emit("chat_update", {
              chatId: finalChatId,
              last_message: message.text,
              last_timestamp: message.timestamp,
              unread_count,
            });
          }
        }

        setTimeout(async () => {
          if (gameInvites.has(inviteId)) {
            gameInvites.delete(inviteId);
            
            await pool.query(
              "UPDATE messages SET game_invite_data = jsonb_set(game_invite_data, '{status}', '\"expired\"') WHERE game_invite_data->>'invite_id' = $1",
              [inviteId]
            );
            
            io.to(finalChatId).emit("game_invite_expired", { inviteId });
          }
        }, 30000);

      } catch (error) {
        console.error("Error sending game invite:", error);
      }
    });

    socket.on("accept_game_invite", async ({ inviteId }) => {
      try {
        console.log(`User ${socket.data.user.id} trying to accept invite ${inviteId}`);
        const invite = gameInvites.get(inviteId);
        console.log('Invite found:', invite);
        
        if (!invite || invite.toUserId !== socket.data.user.id) {
          console.log('Invite not found or user mismatch');
          return;
        }

        // First check in-memory gameSessions and verify with DB
        const existingSessionsInMemory = Array.from(gameSessions.values()).filter(session =>
          ((session.player1.id === invite.fromUserId || session.player2.id === invite.fromUserId) ||
           (session.player1.id === invite.toUserId || session.player2.id === invite.toUserId)) &&
          (session.status === 'waiting' || session.status === 'ready' || session.status === 'in_progress')
        );

        // Verify sessions in memory are still active in DB, clean up if not
        for (const session of existingSessionsInMemory) {
          try {
            const dbCheck = await pool.query(
              "SELECT status FROM games WHERE id = $1",
              [session.id]
            );
            
            if (dbCheck.rows.length === 0 || 
                dbCheck.rows[0].status === 'finished' || 
                dbCheck.rows[0].status === 'abandoned') {
              // Session is finished in DB, remove from memory
              console.log(`Cleaning up finished session ${session.id} from memory`);
              gameSessions.delete(session.id);
            } else if (dbCheck.rows[0].status === 'waiting' || 
                       dbCheck.rows[0].status === 'ready' || 
                       dbCheck.rows[0].status === 'in_progress') {
              // Session is truly active
              console.log(`Active game session ${session.id} exists in memory and DB for players, rejecting invite`);
              io.to(`user_${invite.fromUserId}`).emit("invite_error", { message: 'Один из игроков уже в игре' });
              io.to(`user_${invite.toUserId}`).emit("invite_error", { message: 'Один из игроков уже в игре' });
              return;
            }
          } catch (error) {
            console.error("Error verifying session from DB:", error);
          }
        }

        // Then check database for any other active games
        try {
          const activeGamesCheck = await pool.query(
            `SELECT id, player1_id, player2_id, status FROM games 
             WHERE ((player1_id = $1 OR player2_id = $1) OR (player1_id = $2 OR player2_id = $2))
             AND status IN ('waiting', 'ready', 'in_progress')`,
            [invite.fromUserId, invite.toUserId]
          );

          if (activeGamesCheck.rows.length > 0) {
            console.log(`Active game exists in DB for players, rejecting invite`);
            io.to(`user_${invite.fromUserId}`).emit("invite_error", { message: 'Один из игроков уже в игре' });
            io.to(`user_${invite.toUserId}`).emit("invite_error", { message: 'Один из игроков уже в игре' });
            return;
          }
        } catch (error) {
          console.error("Error checking active games:", error);
        }

        gameInvites.delete(inviteId);

        await pool.query(
          "UPDATE messages SET game_invite_data = jsonb_set(game_invite_data, '{status}', '\"accepted\"') WHERE game_invite_data->>'invite_id' = $1",
          [inviteId]
        );

        const sessionId = uuidv4();
        
        const player1Res = await pool.query("SELECT login, avatar FROM users WHERE id = $1", [invite.fromUserId]);
        const player2Res = await pool.query("SELECT login, avatar FROM users WHERE id = $1", [invite.toUserId]);
        
        const session: GameSession = {
          id: sessionId,
          player1: {
            id: invite.fromUserId,
            username: invite.fromUsername,
            avatar: player1Res.rows[0]?.avatar || null,
            isReady: false
          },
          player2: {
            id: invite.toUserId,
            username: socket.data.user.login,
            avatar: player2Res.rows[0]?.avatar || null,
            isReady: false
          },
          status: 'waiting',
          duration: 10 * 60 * 1000,
          timeRemaining: 10 * 60 * 1000,
          startTime: new Date().toISOString()
        };

        gameSessions.set(sessionId, session);

        try {
          await pool.query(
            "INSERT INTO games (id, player1_id, player2_id, player1_ready, player2_ready, status, duration_ms) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [sessionId, session.player1.id, session.player2.id, session.player1.isReady, session.player2.isReady, session.status, session.duration]
          );
        } catch (error) {
          console.error("Error saving game session to DB:", error);
        }

        console.log(`Emitting game_invite_accepted to user_${invite.fromUserId} and user_${invite.toUserId}`);
        io.to(`user_${invite.fromUserId}`).emit("game_invite_accepted", session);
        io.to(`user_${invite.toUserId}`).emit("game_invite_accepted", session);

      } catch (error) {
        console.error("Error accepting game invite:", error);
      }
    });

    socket.on("decline_game_invite", async ({ inviteId }) => {
      console.log(`User ${socket.data.user.id} trying to decline invite ${inviteId}`);
      const invite = gameInvites.get(inviteId);
      console.log('Invite found for decline:', invite);
      
      if (invite && invite.toUserId === socket.data.user.id) {
        gameInvites.delete(inviteId);
        
        await pool.query(
          "UPDATE messages SET game_invite_data = jsonb_set(game_invite_data, '{status}', '\"declined\"') WHERE game_invite_data->>'invite_id' = $1",
          [inviteId]
        );
        
        console.log(`Emitting game_invite_declined to user_${invite.fromUserId}`);
        io.to(`user_${invite.fromUserId}`).emit("game_invite_declined", { inviteId });
        
        const chatParticipantsRes = await pool.query(
          "SELECT DISTINCT chat_id FROM chat_participants WHERE user_id = ANY($1)",
          [[invite.fromUserId, invite.toUserId]]
        );
        
        for (const chat of chatParticipantsRes.rows) {
          io.to(chat.chat_id).emit("game_invite_declined", { inviteId });
        }
      }
    });

    socket.on("set_player_ready", async ({ sessionId }) => {
      const session = gameSessions.get(sessionId);
      if (!session) return;

      const isPlayer1 = session.player1.id === socket.data.user.id;
      if (isPlayer1) {
        session.player1.isReady = true;
      } else {
        session.player2.isReady = true;
      }

      try {
        await pool.query(
          "UPDATE games SET player1_ready = $1, player2_ready = $2 WHERE id = $3",
          [session.player1.isReady, session.player2.isReady, sessionId]
        );
      } catch (error) {
        console.error("Error updating player ready status:", error);
      }

      if (session.player1.isReady && session.player2.isReady) {
        session.status = 'ready';

        try {
          await pool.query("UPDATE games SET status = 'ready' WHERE id = $1", [sessionId]);
        } catch (error) {
          console.error("Error updating game status to ready:", error);
        }

        setTimeout(async () => {
          session.status = 'in_progress';
          session.startTime = new Date().toISOString();

          try {
            await pool.query(
              "UPDATE games SET status = 'in_progress', start_time = $1 WHERE id = $2",
              [session.startTime, sessionId]
            );
          } catch (error) {
            console.error("Error updating game to in_progress:", error);
          }

          io.to(`user_${session.player1.id}`).emit("game_session_update", session);
          io.to(`user_${session.player2.id}`).emit("game_session_update", session);

          const gameTimer = setInterval(async () => {
            const now = Date.now();
            const startTime = new Date(session.startTime).getTime();
            const elapsed = now - startTime;
            const remaining = Math.max(0, session.duration - elapsed);

            session.timeRemaining = remaining;

            if (remaining <= 0) {
              clearInterval(gameTimer);
              // Don't delete session yet, finishGame will handle it
              await finishGame(sessionId, 'timeout');
            } else {
              io.to(`user_${session.player1.id}`).emit("game_session_update", session);
              io.to(`user_${session.player2.id}`).emit("game_session_update", session);
            }
          }, 1000);
        }, 3000);
      }

      io.to(`user_${session.player1.id}`).emit("game_session_update", session);
      io.to(`user_${session.player2.id}`).emit("game_session_update", session);
    });

    socket.on("join_game_session", async ({ sessionId }) => {
      try {
        const dbCheck = await pool.query(
          "SELECT status FROM games WHERE id = $1",
          [sessionId]
        );

        if (dbCheck.rows.length === 0) {
          socket.emit("game_not_found");
          return;
        }

        const gameStatus = dbCheck.rows[0].status;
        
        // If game is finished or abandoned, send game_session_end to properly disconnect player
        if (gameStatus === 'abandoned' || gameStatus === 'finished') {
          if (gameStatus === 'abandoned') {
            socket.emit("game_session_end", { reason: 'player_left' });
          } else {
            // Game is finished - send complete session data if available
            try {
              const finishedGameRes = await pool.query(
                "SELECT id, player1_id, player2_id, status, start_time, duration_ms, winner_id, end_time FROM games WHERE id = $1",
                [sessionId]
              );
              
              if (finishedGameRes.rows.length > 0) {
                const row = finishedGameRes.rows[0];
                const player1Res = await pool.query("SELECT login, avatar FROM users WHERE id = $1", [row.player1_id]);
                const player2Res = await pool.query("SELECT login, avatar FROM users WHERE id = $1", [row.player2_id]);
                
                let winnerInfo = null;
                if (row.winner_id) {
                  const winnerRes = await pool.query("SELECT id, login FROM users WHERE id = $1", [row.winner_id]);
                  if (winnerRes.rows.length > 0) {
                    winnerInfo = {
                      id: winnerRes.rows[0].id,
                      username: winnerRes.rows[0].login
                    };
                  }
                }
                
                let actualDuration = 0;
                if (row.start_time && row.end_time) {
                  const startTime = new Date(row.start_time).getTime();
                  const endTime = new Date(row.end_time).getTime();
                  actualDuration = Math.max(0, endTime - startTime);
                }
                
                const finalSession = {
                  id: row.id,
                  player1: {
                    id: row.player1_id,
                    username: player1Res.rows[0]?.login || 'Unknown',
                    avatar: player1Res.rows[0]?.avatar || null,
                    isReady: false
                  },
                  player2: {
                    id: row.player2_id,
                    username: player2Res.rows[0]?.login || 'Unknown',
                    avatar: player2Res.rows[0]?.avatar || null,
                    isReady: false
                  },
                  status: 'finished' as const,
                  duration: actualDuration || row.duration_ms || 0,
                  timeRemaining: 0,
                  startTime: row.start_time || new Date().toISOString(),
                  gameResult: 'completed' as const,
                  winner: winnerInfo
                };
                
                socket.emit("game_session_end", finalSession);
              } else {
                socket.emit("game_session_end", { reason: 'finished' });
              }
            } catch (error) {
              console.error("Error loading finished game:", error);
              socket.emit("game_session_end", { reason: 'finished' });
            }
          }
          return;
        }
      } catch (error) {
        console.error("Error checking game status:", error);
        socket.emit("game_not_found");
        return;
      }

      let session = gameSessions.get(sessionId);

      if (!session) {
        try {
          const result = await pool.query(
            "SELECT id, player1_id, player2_id, player1_ready, player2_ready, status, start_time, duration_ms FROM games WHERE id = $1 AND status IN ('waiting', 'ready', 'in_progress')",
            [sessionId]
          );

          if (result.rows.length > 0) {
            const row = result.rows[0];
            const player1Res = await pool.query("SELECT login, avatar FROM users WHERE id = $1", [row.player1_id]);
            const player2Res = await pool.query("SELECT login, avatar FROM users WHERE id = $1", [row.player2_id]);

            session = {
              id: row.id,
              player1: {
                id: row.player1_id,
                username: player1Res.rows[0]?.login || 'Unknown',
                avatar: player1Res.rows[0]?.avatar || null,
                isReady: row.player1_ready
              },
              player2: {
                id: row.player2_id,
                username: player2Res.rows[0]?.login || 'Unknown',
                avatar: player2Res.rows[0]?.avatar || null,
                isReady: row.player2_ready
              },
              status: row.status as GameSession['status'],
              duration: row.duration_ms,
              timeRemaining: row.duration_ms,
              startTime: row.start_time || new Date().toISOString()
            };

            gameSessions.set(sessionId, session);
          }
        } catch (error) {
          console.error("Error loading session from DB:", error);
        }
      }

      if (session) {
        // Double-check session status in case it changed
        if (session.status === 'finished' || session.status === 'abandoned') {
          socket.emit("game_session_end", session.status === 'abandoned' ? { reason: 'player_left' } : { ...session, reason: 'finished' });
          return;
        }
        
        if (session.player1.id === socket.data.user.id || session.player2.id === socket.data.user.id) {
          socket.data.currentGameSession = sessionId;
          socket.emit("game_session_update", session);
        } else {
          socket.emit("game_not_found");
        }
      } else {
        socket.emit("game_not_found");
      }
    });

    socket.on("validate_game_session", async ({ sessionId }) => {
      let session = gameSessions.get(sessionId);
      let isValid = session &&
        (session.player1.id === socket.data.user.id || session.player2.id === socket.data.user.id) &&
        session.status !== 'finished';

      if (!isValid) {
        try {
          const result = await pool.query(
            "SELECT id, player1_id, player2_id, status FROM games WHERE id = $1 AND status IN ('waiting', 'ready', 'in_progress')",
            [sessionId]
          );

          if (result.rows.length > 0) {
            const row = result.rows[0];
            isValid = row.player1_id === socket.data.user.id || row.player2_id === socket.data.user.id;
          }
        } catch (error) {
          console.error("Error validating session from DB:", error);
        }
      }

      socket.emit("session_validation_result", isValid);
    });

    socket.on("leave_game", async ({ sessionId }) => {
      await finishGame(sessionId, 'player_left');
    });

    socket.on("get_users_list", async ({ offset = 0, limit = 100 } = {}) => {
      try {
        const result = await getAllUsers(offset, limit);
        socket.emit("users_list", result);
      } catch (error) {
        console.error("Error getting users list:", error);
        socket.emit("error", { message: "Failed to get users list" });
      }
    });

    socket.on("get_user_profile", async ({ userId }) => {
      try {
        const user = await getUserById(userId);
        if (user) {
          socket.emit("user_profile", user);
        } else {
          socket.emit("error", { message: "User not found" });
        }
      } catch (error) {
        console.error("Error getting user profile:", error);
        socket.emit("error", { message: "Failed to get user profile" });
      }
    });

    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${socket.data.user.id}`);
      
      // Update is_online status
      await pool.query("UPDATE users SET is_online = FALSE WHERE id = $1", [socket.data.user.id]);
      io.emit("user_status", { userId: socket.data.user.id, isOnline: false });
      
      // Emit updated general chat participant count
      const totalCountRes = await pool.query("SELECT COUNT(*) as total FROM users");
      const onlineCountRes = await pool.query("SELECT COUNT(*) as online FROM users WHERE is_online = TRUE");
      io.to('general').emit("general_chat_update", {
        participantsCount: parseInt(totalCountRes.rows[0].total),
        onlineCount: parseInt(onlineCountRes.rows[0].online)
      });
    });
  });
};









