/**
 * Internal domain / persistence types.
 *
 * These describe rows as they exist *inside* the server and are intentionally
 * separate from the wire types in `@presight/shared`. Keeping them apart means
 * a schema change (extra column, denormalisation, computed field) does not
 * automatically leak into the public API contract; the service layer decides
 * what to expose by mapping `UserRow` -> `UserDto`.
 */

export interface UserRow {
  id: number;
  avatar: string;
  first_name: string;
  last_name: string;
  age: number;
  nationality: string;
}

export interface HobbyRow {
  id: number;
  name: string;
}

export interface UserHobbyRow {
  user_id: number;
  hobby_id: number;
}

/** A `UserRow` joined with its hobby names — what the repository returns. */
export interface UserWithHobbies extends UserRow {
  hobbies: string[];
}
