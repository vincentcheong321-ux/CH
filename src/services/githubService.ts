
export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  path: string;
}

const GH_CONFIG_KEY = 'github_config';
const GH_LAST_SYNC_KEY = 'github_last_sync';

export const getGitHubConfig = (): GitHubConfig | null => {
  const data = localStorage.getItem(GH_CONFIG_KEY);
  return data ? JSON.parse(data) : null;
};

export const saveGitHubConfig = (config: GitHubConfig) => {
  localStorage.setItem(GH_CONFIG_KEY, JSON.stringify(config));
};

export const getLastSyncTime = (): string | null => {
  return localStorage.getItem(GH_LAST_SYNC_KEY);
};

export const testGitHubConnection = async (config: GitHubConfig): Promise<boolean> => {
    const { token, owner, repo } = config;
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    try {
        const response = await fetch(url, {
            headers: { Authorization: `token ${token}` }
        });
        return response.ok;
    } catch (e) {
        return false;
    }
};

export const backupToGitHub = async (data: any) => {
  const config = getGitHubConfig();
  if (!config) throw new Error("GitHub configuration missing");

  const { token, owner, repo, path } = config;
  const filePath = path || 'ledger_backup.json';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  
  // 1. Get SHA of existing file (if it exists) to enable update
  let sha = null;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `token ${token}` }
    });
    if (response.ok) {
      const json = await response.json();
      sha = json.sha;
    }
  } catch (e) {
    // Ignore error, file might not exist which is fine
  }

  // 2. Prepare content (Base64 encoding with UTF-8 support)
  const jsonString = JSON.stringify(data, null, 2);
  const content = btoa(
    encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g,
      function toSolidBytes(match, p1) {
          return String.fromCharCode(parseInt(p1, 16));
      })
  );

  const body: any = {
    message: `Backup ${new Date().toISOString().split('T')[0]}`,
    content: content,
    branch