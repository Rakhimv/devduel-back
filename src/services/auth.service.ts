import axios from "axios";
import qs from "qs"










//// GITHUB


interface GitHubOauthToken {
  access_token: string;
}

interface GitHubUser {
  id: number;
  email: string;
  name: string;
  login: string;
  avatar_url: string;
}


export const getGithubOauthToken = async ({ code }: { code: string }): Promise<GitHubOauthToken> => {
  const rootUrl = 'https://github.com/login/oauth/access_token';
  const options = {
    code,
    client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
    client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
  };
  const queryString = qs.stringify(options)
  try {
    const { data } = await axios.post(rootUrl, queryString, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    })
    return qs.parse(data) as unknown as GitHubOauthToken;
  } catch (err: any) {
    throw new Error('Failed to fetch GitHub OAuth token');
  }
}


export const getGithubUser = async ({ access_token }: { access_token: string }): Promise<GitHubUser> => {
  try {
    const { data } = await axios.get<GitHubUser>('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    return data;
  } catch (err: any) {
    throw new Error('Failed to fetch GitHub user');
  }
};












/// YANDEX OAUTH

interface YandexOauthToken {
  access_token: string;
}

interface YandexUser {
  id: string;
  login: string;
  default_email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  default_avatar_id: string;
}

export const getYandexOauthToken = async ({ code }: { code: string }): Promise<YandexOauthToken> => {
  const rootUrl = 'https://oauth.yandex.ru/token';
  const data = qs.stringify({
    grant_type: 'authorization_code',
    code,
    client_id: process.env.YANDEX_OAUTH_CLIENT_ID,
    client_secret: process.env.YANDEX_OAUTH_CLIENT_SECRET,
  });
  try {
    const { data: response } = await axios.post(rootUrl, data, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response;
  } catch (err: any) {
    throw new Error('Failed to fetch Yandex OAuth token: ' + err.message);
  }
};

export const getYandexUser = async ({ access_token }: { access_token: string }): Promise<YandexUser> => {
  try {
    const { data } = await axios.get<YandexUser>('https://login.yandex.ru/info', {
      params: { format: 'json', oauth_token: access_token },
    });
    return data;
  } catch (err: any) {
    throw new Error('Failed to fetch Yandex user: ' + err.message);
  }
};







// GOOGLE OAUTH


interface GoogleOauthToken {
  access_token: string;
}

interface GoogleUser {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email: string;
  email_verified: boolean;
  locale?: string;
}

export const getGoogleOauthToken = async ({ code }: { code: string }): Promise<GoogleOauthToken> => {
  const rootUrl = 'https://oauth2.googleapis.com/token';
  const data = qs.stringify({
    code,
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URL,
    grant_type: 'authorization_code',
  });
  try {
    const { data: response } = await axios.post(rootUrl, data, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response;
  } catch (err: any) {
    throw new Error('Failed to fetch Google OAuth token: ' + err.message);
  }
};

export const getGoogleUser = async ({ access_token }: { access_token: string }): Promise<GoogleUser> => {
  try {
    const { data } = await axios.get<GoogleUser>('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    return data;
  } catch (err: any) {
    throw new Error('Failed to fetch Google user: ' + err.message);
  }
};