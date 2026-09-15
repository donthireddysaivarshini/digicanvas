import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters").max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  contactEmail: z.string().email("Invalid contact email").optional().nullable(),
  contactPhone: z.string().max(20).optional().nullable(),
  timezone: z.string().default("Asia/Kolkata"),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "CLIENT"]),
  organizationId: z.string().optional().nullable(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
