export interface GitHubUser {
  id: number
  login: string
  name: string | null
  avatar_url: string
  html_url: string
  bio: string | null
  company: string | null
  location: string | null
  blog: string
  followers: number
  following: number
  public_repos: number
  created_at: string
}

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  html_url: string
  description: string | null
  language: string | null
  stargazers_count: number
  forks_count: number
  topics: string[]
  license: { key: string; name: string } | null
  archived: boolean
  fork: boolean
  pushed_at: string | null
  updated_at: string
  homepage: string | null
}

export interface GitHubSnapshot {
  user: GitHubUser
  repositories: GitHubRepository[]
  fetchedAt: number
}
