import Home from "./Home";
import Navbar from "../src/components/Navbar";
import "../src/styles.css";
import { useBackend } from "./hooks/useBackend";

function App() {
  const { loading, online, blockchain, error } = useBackend();

  if (loading) {
    return (
      <div style={styles.screen}>
        <p style={styles.text}>Connecting to backend...</p>
      </div>
    );
  }

  if (!online) {
    return (
      <div style={styles.screen}>
        <h2 style={styles.title}>Backend Offline</h2>
        <p style={styles.text}>The backend server is not running. Please start it first:</p>
        <pre style={styles.code}>
          {`# 1. Start blockchain node\nnpx hardhat node\n\n# 2. Deploy contract\nnpx hardhat run scripts/deploy.js --network localhost\n\n# 3. Start backend\ncd backend && npm install && npm start`}
        </pre>
        {error && <p style={styles.error}>{error}</p>}
      </div>
    );
  }

  if (blockchain && !blockchain.connected) {
    return (
      <div style={styles.screen}>
        <h2 style={styles.title}>Blockchain Offline</h2>
        <p style={styles.text}>Backend is running but cannot reach the blockchain node.</p>
        <pre style={styles.code}>npx hardhat node</pre>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <Home />
    </>
  );
}

const styles = {
  screen: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#1a1a2e", color: "#fff", padding: "2rem" },
  title: { fontSize: "2rem", marginBottom: "1rem", color: "#e94560" },
  text: { fontSize: "1.1rem", marginBottom: "1rem", textAlign: "center" },
  code: { background: "#0f3460", padding: "1.5rem", borderRadius: "8px", fontSize: "0.9rem", lineHeight: "1.8", whiteSpace: "pre-wrap" },
  error: { marginTop: "1rem", color: "#ff6b6b", fontSize: "0.9rem" },
};

export default App;
