let abortFlag = false;
let pauseFlag = false;

export function resetTrainControl(): void {
  abortFlag = false;
  pauseFlag = false;
}

export function requestAbort(): void {
  abortFlag = true;
  pauseFlag = false;
}

export function requestPause(): void {
  if (!abortFlag) pauseFlag = true;
}

export function requestResume(): void {
  pauseFlag = false;
}

export function isTrainPaused(): boolean {
  return pauseFlag && !abortFlag;
}

/** Wacht zolang de job gepauzeerd is. Gooit als de gebruiker stopt. */
export async function trainCheckpoint(onPaused?: (paused: boolean) => void): Promise<void> {
  if (abortFlag) throw new Error("Training gestopt");
  if (!pauseFlag) return;
  onPaused?.(true);
  while (pauseFlag && !abortFlag) {
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  if (abortFlag) throw new Error("Training gestopt");
  onPaused?.(false);
}
