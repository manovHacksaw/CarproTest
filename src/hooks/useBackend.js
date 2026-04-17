import { useState, useEffect } from "react";
import { checkBackendHealth } from "../api/backendClient";

/**
 * Checks if the backend is reachable on mount.
 * Components can use this to block rendering until backend is confirmed up.
 */
export function useBackend() {
  const [status, setStatus] = useState({ loading: true, online: false, blockchain: null, error: null });

  useEffect(() => {
    checkBackendHealth()
      .then((data) => {
        setStatus({ loading: false, online: true, blockchain: data.blockchain, error: null });
      })
      .catch((err) => {
        setStatus({ loading: false, online: false, blockchain: null, error: err.message });
      });
  }, []);

  return status;
}
