import { API_BASE } from "./config";

async function request(path) {
  const response = await fetch(`${API_BASE}/nextcloud${path}`);

  if (!response.ok) {
    throw new Error(`Nextcloud API ${path} failed (${response.status})`);
  }

  return response.json();
}

export function getNextcloudStatus() {
  return request("/status");
}

export function getNextcloudInfo() {
  return request("/info");
}

export function getNextcloudUsers() {
  return request("/users");
}

export function getNextcloudStorage() {
  return request("/storage");
}

export function getNextcloudActivity() {
  return request("/activity");
}
