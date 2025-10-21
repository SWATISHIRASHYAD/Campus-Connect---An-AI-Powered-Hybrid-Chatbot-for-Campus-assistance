// src/components/Auth.js
import { auth } from "../firebase";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

function Auth({ user, setUser }) {
  const login = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    setUser(result.user);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <div>
      {user ? (
        <button onClick={logout}>Logout ({user.displayName})</button>
      ) : (
        <button onClick={login}>Login with Google</button>
      )}
    </div>
  );
}

export default Auth;
