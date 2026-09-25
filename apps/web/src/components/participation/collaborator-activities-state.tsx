"use client";

import { createContext, useContext } from "react";

import type { AssignedActivity } from "@/lib/participation/activity-api";

export type CollaboratorActivitiesState = {
  activities: AssignedActivity[] | undefined;
  message: string;
  updateActivity: (activity: AssignedActivity) => void;
};

export const CollaboratorActivitiesContext = createContext<CollaboratorActivitiesState | null>(null);

export function useCollaboratorActivities() {
  return useContext(CollaboratorActivitiesContext);
}
