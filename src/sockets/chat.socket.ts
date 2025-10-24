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
    isReady: boolean;
  };
  player2: {
    id: number;
    username: string;
    isReady: boolean;
  };
  status: 'waiting' | 'ready' | 'in_progress' | 'finished' | 'abandoned';
  duration: number;
  timeRemaining: number;
  startTime: string;
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

async function loadActiveGameSessions() {
  try {
    const result = await pool.query(
      "SELECT id, player1_id, player2_id, player1_ready, player2_ready, status, start_time, duration_ms FROM games WHERE status IN ('waiting', 'ready', 'in_progress')"
    );

    for (const row of result.rows) {
      const player1Res = await pool.query("SELECT login FROM users WHERE id = $1", [row.player1_id]);
      const player2Res = await pool.query("SELECT login FROM users WHERE id = $1", [row.player2_id]);

      const session: GameSession = {
        id: row.id,
        player1: {
          id: row.player1_id,
          username: player1Res.rows[0]?.login || 'Unknown',
          isReady: row.player1_ready
        },
        player2: {
          id: row.player2_id,
          username: player2Res.rows[0]?.login || 'Unknown',
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

    socket.on("join_chat", (chatId: string) => {
      if (!chatId) return;
      
   
      if (socket.data.currentChatId) {
        socket.leave(socket.data.currentChatId);
      }
      
      socket.join(chatId);
      socket.data.currentChatId = chatId;
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
        const toUserRes = await pool.query("SELECT login FROM users WHERE id = $1", [toUserId]);
        const toUsername = toUserRes.rows[0]?.login || 'Unknown';

        const invite = {
          id: inviteId,
          fromUserId: socket.data.user.id,
          fromUsername: socket.data.user.login,
          toUserId,
          toUsername,
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
            from_username: socket.data.user.login,
            to_user_id: toUserId,
            to_username: toUsername,
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
            from_username: socket.data.user.login,
            to_user_id: toUserId,
            to_username: toUsername,
            status: 'pending'
          }
        });

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

        const existingSession = Array.from(gameSessions.values()).find(session =>
          (session.player1.id === socket.data.user.id || session.player2.id === socket.data.user.id) &&
          session.status !== 'finished' && session.status !== 'abandoned'
        );

        if (existingSession) {
          console.log(`User ${socket.data.user.id} already in game ${existingSession.id}, leaving it first`);
          gameSessions.delete(existingSession.id);
          try {
            await pool.query(
              "UPDATE games SET status = 'abandoned', end_time = NOW() WHERE id = $1",
              [existingSession.id]
            );
          } catch (error) {
            console.error("Error abandoning existing game:", error);
          }

          const otherPlayerId = existingSession.player1.id === socket.data.user.id
            ? existingSession.player2.id
            : existingSession.player1.id;

          io.to(`user_${otherPlayerId}`).emit("game_session_end", { reason: 'player_left' });
        }

        gameInvites.delete(inviteId);

        await pool.query(
          "UPDATE messages SET game_invite_data = jsonb_set(game_invite_data, '{status}', '\"accepted\"') WHERE game_invite_data->>'invite_id' = $1",
          [inviteId]
        );

        const sessionId = uuidv4();
        const session: GameSession = {
          id: sessionId,
          player1: {
            id: invite.fromUserId,
            username: invite.fromUsername,
            isReady: false
          },
          player2: {
            id: invite.toUserId,
            username: socket.data.user.login,
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
              session.status = 'finished';
              clearInterval(gameTimer);
              gameSessions.delete(sessionId);

              try {
                await pool.query(
                  "UPDATE games SET status = 'finished', end_time = NOW() WHERE id = $1",
                  [sessionId]
                );
              } catch (error) {
                console.error("Error updating game status to finished:", error);
              }

              io.to(`user_${session.player1.id}`).emit("game_session_end", session);
              io.to(`user_${session.player2.id}`).emit("game_session_end", session);

              const chatParticipantsRes = await pool.query(
                "SELECT DISTINCT chat_id FROM chat_participants WHERE user_id = ANY($1)",
                [[session.player1.id, session.player2.id]]
              );

              for (const chat of chatParticipantsRes.rows) {
                io.to(chat.chat_id).emit("game_end_notification", {
                  reason: 'timeout',
                  duration: session.duration
                });
              }
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
      let session = gameSessions.get(sessionId);

      if (!session) {
        try {
          const result = await pool.query(
            "SELECT id, player1_id, player2_id, player1_ready, player2_ready, status, start_time, duration_ms FROM games WHERE id = $1 AND status IN ('waiting', 'ready', 'in_progress')",
            [sessionId]
          );

          if (result.rows.length > 0) {
            const row = result.rows[0];
            const player1Res = await pool.query("SELECT login FROM users WHERE id = $1", [row.player1_id]);
            const player2Res = await pool.query("SELECT login FROM users WHERE id = $1", [row.player2_id]);

            session = {
              id: row.id,
              player1: {
                id: row.player1_id,
                username: player1Res.rows[0]?.login || 'Unknown',
                isReady: row.player1_ready
              },
              player2: {
                id: row.player2_id,
                username: player2Res.rows[0]?.login || 'Unknown',
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
      const session = gameSessions.get(sessionId);
      if (session) {
        gameSessions.delete(sessionId);

        try {
          await pool.query(
            "UPDATE games SET status = 'abandoned', end_time = NOW() WHERE id = $1",
            [sessionId]
          );
        } catch (error) {
          console.error("Error updating game status:", error);
        }

        const otherPlayerId = session.player1.id === socket.data.user.id
          ? session.player2.id
          : session.player1.id;

        io.to(`user_${otherPlayerId}`).emit("game_session_end", { reason: 'player_left' });

        const chatParticipantsRes = await pool.query(
          "SELECT DISTINCT chat_id FROM chat_participants WHERE user_id = ANY($1)",
          [[session.player1.id, session.player2.id]]
        );

        for (const chat of chatParticipantsRes.rows) {
          io.to(chat.chat_id).emit("game_end_notification", {
            reason: 'player_left',
            duration: session.duration
          });

          const updateRes = await pool.query(
            "UPDATE messages SET game_invite_data = jsonb_set(game_invite_data, '{status}', '\"abandoned\"') WHERE game_invite_data->>'from_user_id' = ANY($1) AND game_invite_data->>'status' = '\"accepted\"' AND chat_id = $2 RETURNING game_invite_data->>'invite_id' as invite_id",
            [[session.player1.id, session.player2.id], chat.chat_id]
          );

          for (const row of updateRes.rows) {
            if (row.invite_id) {
              io.to(chat.chat_id).emit("game_invite_abandoned", { inviteId: row.invite_id });
            }
          }
        }
      }
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
      await pool.query("UPDATE users SET is_online = FALSE WHERE id = $1", [socket.data.user.id]);
      io.emit("user_status", { userId: socket.data.user.id, isOnline: false });
    });
  });
};









