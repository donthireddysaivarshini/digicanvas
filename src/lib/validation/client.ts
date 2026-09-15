import { z } from "zod";

export const createClientSchema = z.object({
  name: z
    .string({ required_error: "Client name is required" })
    .trim()
    .min(2, "Client name must be at least 2 characters")
    .max(100, "Client name cannot exceed 100 characters"),
  slug: z
    .string({ required_error: "Slug is required" })
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug cannot exceed 50 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  contactEmail: z
    .string()
    .trim()
    .email("Please enter a valid contact email")
    .optional()
    .or(z.literal("")),
  contactPhone: z
    .string()
    .trim()
    .max(20, "Contact phone cannot exceed 20 characters")
    .optional()
    .or(z.literal("")),
  timezone: z
    .string({ required_error: "Timezone is required" })
    .default("Asia/Kolkata"),
  userName: z
    .string({ required_error: "Primary user name is required" })
    .trim()
    .min(2, "User name must be at least 2 characters")
    .max(100),
  userEmail: z
    .string({ required_error: "User login email is required" })
    .trim()
    .toLowerCase()
    .email("Please enter a valid login email address"),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = z.object({
  id: z.string().min(1, "Client ID is required"),
  name: z
    .string({ required_error: "Client name is required" })
    .trim()
    .min(2, "Client name must be at least 2 characters")
    .max(100),
  contactEmail: z
    .string()
    .trim()
    .email("Please enter a valid contact email")
    .optional()
    .or(z.literal("")),
  contactPhone: z
    .string()
    .trim()
    .max(20, "Contact phone cannot exceed 20 characters")
    .optional()
    .or(z.literal("")),
  timezone: z
    .string({ required_error: "Timezone is required" })
    .default("Asia/Kolkata"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type UpdateClientInput = z.infer<typeof updateClientSchema>;
