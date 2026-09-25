export type TerminalClock = {
  display: string;
  dateTime: string;
};

const twoDigits = (value: number) => String(value).padStart(2, "0");

/** Format the learner device clock in the viewer's local timezone. */
export function formatTerminalDateTime(value: Date): TerminalClock {
  return {
    display: `${value.getFullYear()}.${twoDigits(value.getMonth() + 1)}.${twoDigits(value.getDate())} ${twoDigits(value.getHours())}:${twoDigits(value.getMinutes())}`,
    dateTime: value.toISOString(),
  };
}
