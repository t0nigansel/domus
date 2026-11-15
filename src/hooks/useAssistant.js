import { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api";

export function useAssistant(path, enabled = true) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    if (enabled) setData(await api.get(path));
  }, [path, enabled]);
  useEffect(() => {
    let active = true;
    if (enabled)
      api
        .get(path)
        .then((value) => {
          if (active) setData(value);
        })
        .catch((error) => {
          if (active) setError(error.message);
        });
    return () => {
      active = false;
    };
  }, [path, enabled]);
  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      return await action();
    } catch (error) {
      setError(error.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { data, setData, error, busy, run, refresh };
}

export function useRecordJob(recordId) {
  const [job, setJob] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => {
    let active = true;
    api
      .get("/jobs")
      .then((jobs) => {
        const running = jobs.find(
          (job) =>
            job.input?.recordId === recordId &&
            ["queued", "running"].includes(job.status),
        );
        if (active && running) {
          setJob((previous) => previous || running.id);
          setWorking(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [recordId]);
  return { job, setJob, working, setWorking };
}
