import { lbSignUp, linkManagementEmployee } from "@/lib/lb-api";

export const RIDER_EMAIL_DOMAIN = "rider.londonbite.local";

export const riderEmailFromUsername = (username: string) =>
  `${username.trim().toLowerCase()}@${RIDER_EMAIL_DOMAIN}`;

export async function createRiderLogin(
  managementToken: string,
  employeeId: string,
  username: string,
  pin: string,
) {
  const cleanUsername = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,24}$/.test(cleanUsername)) {
    throw new Error("Username must be 3–24 characters: a-z, 0-9, dot, underscore or hyphen.");
  }
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error("PIN must be 4–6 digits.");
  }

  const email = riderEmailFromUsername(cleanUsername);
  const result = await lbSignUp(email, pin);
  if (!("access_token" in result) && !result.user) {
    throw new Error("Rider account could not be created.");
  }

  await linkManagementEmployee(managementToken, employeeId, email, "rider");
  return { username: cleanUsername };
}
