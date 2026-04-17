export interface GitHubRepoRaw {
  id: number;
  full_name: string;
  name: string;
  owner: {
    login: string;
    avatar_url?: string;
    html_url?: string;
  };
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  pushed_at: string;
}
