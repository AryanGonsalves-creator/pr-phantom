/**
 * PR Phantom — Multi-Diff Preset Library
 * Real-world, beginner-friendly diff scenarios for testing and learning.
 */

export interface DiffPreset {
  id: string;
  name: string;
  icon: string;
  category: 'Security' | 'Bugfix' | 'Frontend' | 'Backend';
  tag: string;
  description: string;
  diff: string;
}

export const DIFF_PRESETS: DiffPreset[] = [
  {
    id: 'auth-fix',
    name: 'Auth Bugfix & Console Leak',
    icon: '🎃',
    category: 'Bugfix',
    tag: 'Authentication',
    description: 'Fixes password comparison and adds debug logging in user authentication.',
    diff: `diff --git a/src/auth/login.ts b/src/auth/login.ts
index 83a1b4e..94f2c01 100644
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -14,6 +14,8 @@ export async function handleLogin(req: Request, res: Response) {
   const { email, password } = req.body;
+  console.log("Attempting login for user email:", email);
+  console.log("DEBUG: password length received:", password ? password.length : 0);
 
   const user = await findUserByEmail(email);
   if (!user) {
@@ -32,3 +34,4 @@ export async function handleLogin(req: Request, res: Response) {
-  const isValid = password === user.passwordHash;
+  const isValid = await bcrypt.compare(password, user.passwordHash);
   if (!isValid) {
     return res.status(401).json({ error: "Invalid credentials" });
   }
diff --git a/src/middleware/rateLimit.ts b/src/middleware/rateLimit.ts
new file mode 100644
index 0000000..f92c103
--- /dev/null
+++ b/src/middleware/rateLimit.ts
@@ -0,0 +1,9 @@
+import rateLimit from "express-rate-limit";
+
+export const loginLimiter = rateLimit({
+  windowMs: 15 * 60 * 1000, // 15 minutes
+  max: 5, // Limit each IP to 5 login attempts per window
+  message: "Too many failed login attempts, please try again after 15 minutes",
+  standardHeaders: true,
+  legacyHeaders: false,
+});
diff --git a/src/config/session.ts b/src/config/session.ts
index 192a34f..882cd41 100644
--- a/src/config/session.ts
+++ b/src/config/session.ts
@@ -8,3 +8,3 @@ export const sessionConfig = {
-  secret: "change_me_in_production_12345",
+  secret: process.env.SESSION_SECRET || "fallback_dev_secret",
   resave: false,
-  cookie: { secure: false, maxAge: 86400000 }
+  cookie: { secure: process.env.NODE_ENV === "production", maxAge: 86400000 }
 };`
  },
  {
    id: 'security-audit',
    name: 'SQL Injection & Input Sanitization',
    icon: '🛡️',
    category: 'Security',
    tag: 'Vulnerability Patch',
    description: 'Replaces raw string concatenation in SQL queries with safe parameterized statements.',
    diff: `diff --git a/server/db/users.ts b/server/db/users.ts
index b18210f..4f2910a 100644
--- a/server/db/users.ts
+++ b/server/db/users.ts
@@ -18,6 +18,6 @@ export async function searchUsers(searchTerm: string) {
-  // Vulnerable to SQL injection!
-  const query = "SELECT id, username, email FROM users WHERE username LIKE '%" + searchTerm + "%'";
-  const result = await db.raw(query);
+  // Parameterized query prevents SQL injection attacks
+  const query = "SELECT id, username, email FROM users WHERE username LIKE ?";
+  const result = await db.raw(query, ['%' + searchTerm + '%']);
   return result.rows;
 }
@@ -35,5 +35,8 @@ export async function updateProfile(userId: string, data: ProfileData) {
+  if (!isValidDisplayName(data.displayName)) {
+    throw new Error("Display name contains invalid characters");
+  }
   await db('users')
     .where({ id: userId })
-    .update({ bio: data.bio });
+    .update({ bio: sanitizeHtml(data.bio), displayName: data.displayName });
 }`
  },
  {
    id: 'react-refactor',
    name: 'Component Memoization & Skeleton',
    icon: '⚡',
    category: 'Frontend',
    tag: 'Performance',
    description: 'Avoids heavy re-renders by wrapping calculations with useMemo and adding a loading skeleton.',
    diff: `diff --git a/src/components/HalloweenFeed.tsx b/src/components/HalloweenFeed.tsx
index 451a92e..77a102b 100644
--- a/src/components/HalloweenFeed.tsx
+++ b/src/components/HalloweenFeed.tsx
@@ -1,7 +1,8 @@
-import React, { useState, useEffect } from 'react';
+import React, { useState, useEffect, useMemo, useCallback } from 'react';
 import { PostCard } from './PostCard';
+import { SkeletonFeed } from './SkeletonFeed';
 
 export function HalloweenFeed({ filterTag }: { filterTag: string }) {
   const [posts, setPosts] = useState<Post[]>([]);
-  const [loading, setLoading] = useState(false);
+  const [loading, setLoading] = useState(true);
@@ -15,5 +16,8 @@ export function HalloweenFeed({ filterTag }: { filterTag: string }) {
 
-  // Re-filtering on every single parent re-render was causing sluggish scrolling
-  const filteredPosts = posts.filter(p => filterTag === 'all' || p.tags.includes(filterTag));
+  const filteredPosts = useMemo(() => {
+    return posts.filter(p => filterTag === 'all' || p.tags.includes(filterTag));
+  }, [posts, filterTag]);
+
+  const handleLike = useCallback((postId: string) => {
+    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
+  }, []);
@@ -28,3 +32,3 @@ export function HalloweenFeed({ filterTag }: { filterTag: string }) {
-  return <div>{filteredPosts.map(p => <PostCard key={p.id} post={p} />)}</div>;
+  if (loading) return <SkeletonFeed count={4} />;
+  return <div>{filteredPosts.map(p => <PostCard key={p.id} post={p} onLike={handleLike} />)}</div>;
 }`
  },
  {
    id: 'db-migration',
    name: 'Schema Migration & Indexing',
    icon: '📦',
    category: 'Backend',
    tag: 'Database',
    description: 'Adds an index on user emails for faster queries and introduces soft deletion columns.',
    diff: `diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index 72bc30a..90cc112 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -22,6 +22,10 @@ model User {
   role        String   @default("user")
   createdAt   DateTime @default(now())
+  deletedAt   DateTime?
 
   posts       Post[]
+
+  @@index([email])
+  @@index([deletedAt])
 }
diff --git a/server/repositories/userRepo.ts b/server/repositories/userRepo.ts
index e01a992..21a930f 100644
--- a/server/repositories/userRepo.ts
+++ b/server/repositories/userRepo.ts
@@ -12,3 +12,4 @@ export async function findActiveUsers() {
   return prisma.user.findMany({
-    where: {}
+    where: { deletedAt: null },
+    select: { id: true, email: true, name: true }
   });
@@ -25,3 +26,3 @@ export async function deleteUser(id: string) {
-  return prisma.user.delete({ where: { id } });
+  return prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
 }`
  }
];
