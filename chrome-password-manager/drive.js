// Komunikacja z Dyskiem Google (zakres drive.file — dostęp tylko do plików
// utworzonych przez tę aplikację). Sejf jest trzymany jako zaszyfrowany plik
// JSON w widocznym folderze na Dysku użytkownika.

export const FOLDER_NAME = "Sejf Haseł";
export const FILE_NAME = "sejf-hasel.vault.json";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export function getToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(
          new Error(
            chrome.runtime.lastError?.message ||
              "Nie udało się uzyskać dostępu do konta Google."
          )
        );
      } else {
        resolve(token);
      }
    });
  });
}

function removeCachedToken(token) {
  return new Promise((resolve) =>
    chrome.identity.removeCachedAuthToken({ token }, resolve)
  );
}

async function driveFetch(token, url, options = {}, retried = false) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (res.status === 401 && !retried) {
    // Token wygasł — usuwamy z pamięci podręcznej i próbujemy raz jeszcze.
    await removeCachedToken(token);
    const fresh = await getToken(false);
    return driveFetch(fresh, url, options, true);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Dysk Google: błąd ${res.status}. ${body.slice(0, 200)}`);
  }
  return res;
}

export async function ensureFolder(token) {
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await driveFetch(token, `${API}/files?q=${q}&fields=files(id,name)`);
  const { files } = await res.json();
  if (files?.length) return files[0].id;

  const createRes = await driveFetch(token, `${API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  return (await createRes.json()).id;
}

export async function findVaultFile(token, folderId) {
  const q = encodeURIComponent(
    `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`
  );
  const res = await driveFetch(
    token,
    `${API}/files?q=${q}&fields=files(id,name,modifiedTime)`
  );
  const { files } = await res.json();
  return files?.[0] || null;
}

export async function downloadVault(token, fileId) {
  const res = await driveFetch(token, `${API}/files/${fileId}?alt=media`);
  return res.json();
}

export async function uploadVault(token, folderId, fileId, payload) {
  const body = JSON.stringify(payload);
  if (fileId) {
    await driveFetch(
      token,
      `${UPLOAD_API}/files/${fileId}?uploadType=media&fields=id`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      }
    );
    return fileId;
  }
  const metadata = { name: FILE_NAME, parents: [folderId] };
  const boundary = "sejfhasel" + Math.random().toString(36).slice(2);
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    body +
    `\r\n--${boundary}--`;
  const res = await driveFetch(
    token,
    `${UPLOAD_API}/files?uploadType=multipart&fields=id`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: multipart,
    }
  );
  return (await res.json()).id;
}
