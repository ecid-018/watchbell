import React, { useState } from "react";

import Setup from "./Setup.jsx";
import Watchbell from "./Watchbell.jsx";
import { K, readJSON, writeJSON } from "./storage.js";

export default function App() {
  const [start, setStart] = useState(() => readJSON(K.start, null));
  const [editing, setEditing] = useState(false);

  if (!start || editing) {
    return (
      <Setup
        value={start}
        onSave={(v) => {
          writeJSON(K.start, v);
          setStart(v);
          setEditing(false);
        }}
        onCancel={start ? () => setEditing(false) : null}
      />
    );
  }

  return <Watchbell voyageStart={start} onChangeStart={() => setEditing(true)} />;
}
