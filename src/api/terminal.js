import apiClient from "../services/apiClient";

export async function getTerminalInfo() {
  const { data } = await apiClient.get("/terminal/info");
  return data;
}

export async function createTerminalSession() {
  const { data } = await apiClient.post("/terminal/session");
  return data;
}

export async function sendTerminalInput(sessionId, input) {
  const { data } = await apiClient.post(`/terminal/session/${sessionId}/input`, {
    input,
  });
  return data;
}

export async function readTerminalOutput(sessionId) {
  const { data } = await apiClient.get(`/terminal/session/${sessionId}/output`);
  return data;
}

export async function interruptTerminalSession(sessionId) {
  const { data } = await apiClient.post(
    `/terminal/session/${sessionId}/interrupt`
  );
  return data;
}

export async function closeTerminalSession(sessionId) {
  const { data } = await apiClient.delete(`/terminal/session/${sessionId}`);
  return data;
}
