import React from "react";
import { Editor } from "react-draft-wysiwyg";

const Draft = ({ editorState, onEditorStateChange }) => {
  return (
    <div style={{ minHeight: "250px !important", maxHeight: "200 !important" }}>
      <Editor
        editorClassName={{ maxHeight: "200 !important", overflow: "auto" }}
        editorState={editorState}
        onEditorStateChange={onEditorStateChange}
        toolbar={{
          inline: { inDropdown: true },
          list: { inDropdown: true },
          textAlign: { inDropdown: true },
          link: { inDropdown: true },
          history: { inDropdown: true },
        }}
      />
    </div>
  );
};

export default Draft;
