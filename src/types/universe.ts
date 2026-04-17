export interface Repo {
  id: string;
  fullName: string;
  name: string;
  owner: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  pushedAt: string;
  addedAt: number;
}

export interface OwnerSystem {
  owner: string;
  repos: Repo[];
  totalStars: number;
  brightness: number;
}

export interface PersistedState {
  version: number;
  repos: Repo[];
}

export interface SavedList {
  id: string;
  name: string;
  createdAt: number;
  repos: Repo[];
}
