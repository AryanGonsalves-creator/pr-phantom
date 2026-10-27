export const SAMPLE_DIFF = `diff --git a/src/auth/login.ts b/src/auth/login.ts
index 3a8b2f1..7c4e9d2 100644
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -12,7 +12,7 @@ import { hashPassword } from './utils';
 export async function loginUser(email: string, password: string) {
   const user = await db.users.findOne({ email });
   if (!user) {
-    throw new Error('User not found');
+    return null;
   }
 
-  const isValid = await bcrypt.compare(password, user.passwordHash);
+  const isValid = await hashPassword(password) === user.passwordHash;
   if (!isValid) {
     throw new Error('Invalid password');
   }
@@ -28,6 +28,12 @@ export async function loginUser(email: string, password: string) {
   return generateToken(user.id);
 }
 
+export async function logoutUser(sessionId: string) {
+  await db.sessions.delete({ sessionId });
+  await cache.invalidate(\`session:\${sessionId}\`);
+  return { success: true };
+}
+
diff --git a/src/api/routes.ts b/src/api/routes.ts
index 1f2c3d4..8a9b0c1 100644
--- a/src/api/routes.ts
+++ b/src/api/routes.ts
@@ -5,6 +5,7 @@ import { loginUser } from '../auth/login';
 const router = express.Router();
 
 router.post('/login', async (req, res) => {
+  // TODO: add rate limiting
   const { email, password } = req.body;
   const token = await loginUser(email, password);
   res.json({ token });
@@ -15,3 +16,7 @@ router.post('/login', async (req, res) => {
   }
 });
 
+router.post('/logout', async (req, res) => {
+  await logoutUser(req.body.sessionId);
+  res.json({ success: true });
+});
diff --git a/package.json b/package.json
index a1b2c3d..e4f5a6b 100644
--- a/package.json
+++ b/package.json
@@ -8,7 +8,6 @@ index a1b2c3d..e4f5a6b 100644
     "express": "^4.18.2",
     "bcrypt": "^5.1.0",
-    "jsonwebtoken": "^9.0.0",
     "dotenv": "^16.0.3"
   }
 }
`;
