import { useEffect, useMemo, useState } from "react";
import TopBar from "./components/TopBar";
import { Modal, Toasts, UpdateBanner, toast } from "./components/UI";
import { navigate, useLocation } from "./lib/router";
import { boot, create, setEditorKey, useStore } from "./lib/store";
import Assessments from "./pages/Assessments";
import Compare from "./pages/Compare";
import Landing from "./pages/Landing";
import Method from "./pages/Method";
import PlanDetail from "./pages/PlanDetail";
import Plans from "./pages/Plans";
import Updates from "./pages/Updates";
import Workspace from "./pages/Workspace";

export default function App() {
  const { path } = useLocation();
  const { editor } = useStore();
  const [keyOpen, setKeyOpen] = useState(false);
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    boot();
  }, []);

  useEffect(() => {
    const titles: Record<string, string> = { "/plans": "תוכניות בעיר", "/assessments": "הערכות", "/compare": "השוואה", "/updates": "מה חדש", "/method": "שיטה" };
    document.title = titles[path] ? `${titles[path]} · שכונה 360°` : "שכונה 360° · עיריית אשדוד";
  }, [path]);

  const globalItems = useMemo(
    () => [
      { label: "הערכה חדשה", onSelect: () => navigate(`/a/${create().id}`) },
      editor
        ? {
            label: `יציאה ממצב עורך (${editor})`,
            pressed: true,
            onSelect: () => {
              setEditorKey(null);
              toast("יצאת ממצב עורך");
            },
          }
        : { label: "כניסת עורך", onSelect: () => setKeyOpen(true) },
    ],
    [editor],
  );

  const m = path.match(/^\/a\/([\w-]+)/);
  const pm = path.match(/^\/plans\/([\w-]+)/);
  const page = m ? (
    <Workspace id={m[1]} key={m[1]} />
  ) : pm ? (
    <PlanDetail id={pm[1]} key={pm[1]} />
  ) : path === "/plans" ? (
    <Plans />
  ) : path === "/assessments" ? (
    <Assessments />
  ) : path === "/compare" ? (
    <Compare />
  ) : path === "/updates" ? (
    <Updates />
  ) : path === "/method" ? (
    <Method />
  ) : (
    <Landing />
  );

  return (
    <>
      <TopBar globalItems={globalItems} />
      <div className="view">{page}</div>
      <Toasts />
      <UpdateBanner />
      <Modal open={keyOpen} onClose={() => setKeyOpen(false)} title="כניסת עורך">
        <form
          className="key-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr("");
            const who = await setEditorKey(key.trim());
            if (who) {
              setKeyOpen(false);
              setKey("");
              toast(`שלום ${who}. ההערכות יישמרו בשרת העירוני.`);
            } else setErr("המפתח לא זוהה, או שאין חיבור לשרת.");
          }}
        >
          <p className="muted">עורכים מורשים שומרים ומפרסמים הערכות בשרת של עיריית אשדוד. בלי מפתח, ההערכות נשמרות בדפדפן בלבד.</p>
          <input className="input" type="password" autoComplete="off" placeholder="מפתח עורך" value={key} onChange={(e) => setKey(e.target.value)} aria-label="מפתח עורך" />
          {err && <p className="err">{err}</p>}
          <div className="row-end">
            <button type="submit" className="btn" disabled={!key.trim()}>
              כניסה
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
