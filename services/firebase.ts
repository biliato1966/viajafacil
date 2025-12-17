import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { AppData } from "../types";

// COLOQUE SUAS CHAVES DO FIREBASE AQUI
// Você consegue essas chaves criando um projeto em: https://console.firebase.google.com/
const firebaseConfig = {
  apiKey: "AIzaSyATA6QX1hMpSKU3DhjOwibGotwmNDM-NAE",
  authDomain: "viajefacil-a9927.firebaseapp.com",
  projectId: "viajefacil-a9927",
  storageBucket: "viajefacil-a9927.firebasestorage.app",
  messagingSenderId: "21226643810",
  appId: "1:21226643810:web:550c5e5558c4b21b760c3b"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Funções de Autenticação
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Erro no login Google:", error);
    throw error;
  }
};

export const loginAnonymously = async () => {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error: any) {
    // Se o erro for de configuração (admin-restricted), não poluir o console com erro vermelho
    if (error.code !== 'auth/admin-restricted-operation' && error.code !== 'auth/operation-not-allowed') {
      console.error("Erro no login anônimo:", error);
    }
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Erro no logout:", error);
  }
};

// Funções de Banco de Dados (Firestore)
export const saveUserData = async (userId: string, data: AppData) => {
  if (!userId) return;
  try {
    // Salva na coleção 'users', documento com ID do usuário
    await setDoc(doc(db, "users", userId), data);
    // Log removido para não poluir console em salvamento frequente, descomente para debug
    // console.log("Dados salvos na nuvem!");
  } catch (error) {
    console.error("Erro ao salvar dados:", error);
    throw error;
  }
};

export const loadUserData = async (userId: string): Promise<AppData | null> => {
  if (!userId) return null;
  try {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as AppData;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    return null;
  }
};