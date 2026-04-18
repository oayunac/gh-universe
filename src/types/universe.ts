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
  // Optional hydration flag. Undefined/true means all other fields are real
  // GitHub metadata. False means this repo was added from a share link or
  // similar placeholder source and the stats/description/etc. are defaults
  // that need refetching before they're shown as truth.
  hydrated?: boolean;
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
