export const USER_PROFILE_KEY = 'vc_user_profile';

export const DEFAULT_USER_PROFILE = {
  name: '',
  headline: '',
  bio: '',
  location: '',
  avatarDataUrl: '',
  socials: {
    instagram: '',
    x: '',
    youtube: '',
    tiktok: '',
  },
};

export function normalizeUserProfile(value = {}) {
  return {
    ...DEFAULT_USER_PROFILE,
    ...value,
    socials: {
      ...DEFAULT_USER_PROFILE.socials,
      ...(value.socials || {}),
    },
  };
}

export function loadUserProfile() {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return normalizeUserProfile();
    return normalizeUserProfile(JSON.parse(raw));
  } catch {
    return normalizeUserProfile();
  }
}

export function saveUserProfile(profile) {
  const next = normalizeUserProfile(profile);
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(next));
  return next;
}

export function profileDisplayName(profile, email) {
  const name = String(profile?.name || '').trim();
  if (name) return name;
  const local = String(email || '').split('@')[0]?.trim();
  return local || 'Criador';
}

export function profileInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
