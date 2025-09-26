export interface User {
    id: number;
    name: string;
    login: string;
    email: string;
    avatar: string | null;
    provider: string;
    role: string;
    password: string;
}


