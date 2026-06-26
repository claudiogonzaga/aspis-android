// Checagem de atualização in-app (port do CoMentor). Consulta o último release
// do GitHub, compara com a versão instalada e devolve o link do APK para baixar.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const REPO = 'claudiogonzaga/aspis-android';
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const LAST_CHECK_KEY = 'aspis.lastUpdateCheckAt';
const SKIPPED_VERSION_KEY = 'aspis.skippedVersion';

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string | null;
  downloadUrl: string | null; // APK anexado ao release
  releaseUrl: string | null; // página do release (fallback)
  notes: string | null;
  publishedAt: string | null;
}

export function getCurrentVersion(): string {
  return (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';
}

function normalize(v: string): string {
  return v.trim().replace(/^v/i, '');
}

// Compara semver simples (1.2.10 > 1.2.9). Partes não-numéricas viram 0.
function compare(a: string, b: string): number {
  const an = normalize(a).split(/[.+-]/).map((p) => parseInt(p, 10) || 0);
  const bn = normalize(b).split(/[.+-]/).map((p) => parseInt(p, 10) || 0);
  const len = Math.max(an.length, bn.length);
  for (let i = 0; i < len; i++) {
    const ai = an[i] ?? 0;
    const bi = bn[i] ?? 0;
    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }
  return 0;
}

interface GhAsset {
  name: string;
  browser_download_url: string;
}

interface GhRelease {
  tag_name: string;
  body: string;
  published_at: string;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
  assets: GhAsset[];
}

/**
 * Checa o último release. `force=false` respeita um throttle de 6h (para o
 * disparo automático na abertura); `force=true` ignora (botão "verificar").
 */
export async function checkForUpdate(force = false): Promise<UpdateInfo> {
  const current = getCurrentVersion();
  const empty: UpdateInfo = {
    available: false,
    currentVersion: current,
    latestVersion: null,
    downloadUrl: null,
    releaseUrl: null,
    notes: null,
    publishedAt: null,
  };

  if (!force) {
    const last = await AsyncStorage.getItem(LAST_CHECK_KEY);
    if (last && Date.now() - Number(last) < 6 * 60 * 60 * 1000) {
      return empty; // checado há menos de 6h
    }
  }

  try {
    const res = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      if (res.status === 404) return empty;
      throw new Error(`GitHub API ${res.status}`);
    }
    const release = (await res.json()) as GhRelease;
    if (release.draft || release.prerelease) return empty;

    await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()));

    const apkAsset =
      release.assets.find((a) => a.name.toLowerCase().endsWith('.apk')) ?? null;
    const latest = release.tag_name;
    const isNewer = compare(latest, current) > 0;

    return {
      available: isNewer,
      currentVersion: current,
      latestVersion: normalize(latest),
      downloadUrl: apkAsset?.browser_download_url ?? null,
      releaseUrl: release.html_url,
      notes: release.body || null,
      publishedAt: release.published_at,
    };
  } catch (err) {
    console.warn('update check failed:', err);
    return empty;
  }
}

export async function isVersionSkipped(version: string): Promise<boolean> {
  const skipped = await AsyncStorage.getItem(SKIPPED_VERSION_KEY);
  return skipped === normalize(version);
}

export async function skipVersion(version: string): Promise<void> {
  await AsyncStorage.setItem(SKIPPED_VERSION_KEY, normalize(version));
}

export async function clearSkip(): Promise<void> {
  await AsyncStorage.removeItem(SKIPPED_VERSION_KEY);
}
