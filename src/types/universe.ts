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

export type ViewMode = "universe" | "system";

export interface ViewState {
  mode: ViewMode;
  focusedOwner: string | null;
  hoveredRepoId: string | null;
}

export interface PersistedState {
  version: number;
  repos: Repo[];
}
