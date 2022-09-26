import React, { useEffect, useState } from "react";
import axios from "axios";
import Editor from "../Editor/Editor";
import socket from "../socket.io";
import { debounce } from "lodash";
import { decode as base64_decode, encode as base64_encode } from "base-64";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./PlayGround.css";
import WhiteBoard from "../WhiteBoard/WhiteBoard";
import { EditorState, convertFromRaw, convertToRaw } from "draft-js";
import Digital from "react-activity/dist/Digital";
import "react-activity/dist/Digital.css";
import Loader from "react-loader-advanced";
import allLanguageDefaultCode from "./Language/Default";

function PlayGround(props) {
  const languageToEditorMode = {
    c: "c_cpp",
    cpp: "c_cpp",
    python: "python",
    java: "java",
    javascript: "javascript",
  };
  const languages = Object.keys(languageToEditorMode);
  const themes = [
    "monokai",
    "github",
    "solarized_dark",
    "dracula",
    "eclipse",
    "tomorrow_night",
    "tomorrow_night_blue",
    "xcode",
    "ambiance",
    "solarized_light",
  ];
  const fontSizes = [
    "8",
    "10",
    "12",
    "14",
    "16",
    "18",
    "20",
    "22",
    "24",
    "26",
    "28",
    "30",
    "32",
  ];
  const [roomBody, setRoomBody] = useState("");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const [language, setLanguage] = useState(
    localStorage.getItem("language") ?? "c"
  );
  const [theme, setTheme] = useState(
    localStorage.getItem("theme") ?? "monokai"
  );
  const [fontSize, setFontSize] = useState(12);
  const idealState = "Idle";
  const runningState = "running";
  const [submissionState, setSubmissionState] = useState(idealState);
  const [loader, setLoader] = useState(false);
  const [editorState, setEditorState] = useState(() =>
    EditorState.createEmpty()
  );

  useEffect(() => {
    if (language === "cpp") {
      setRoomBody(allLanguageDefaultCode.cpp);
    } else if (language === "c") {
      setRoomBody(allLanguageDefaultCode.c);
    } else if (language === "java") {
      setRoomBody(allLanguageDefaultCode.java);
    } else if (language === "python") {
      setRoomBody(allLanguageDefaultCode.python);
    } else if (language === "javascript") {
      setRoomBody(allLanguageDefaultCode.javascript);
    } else {
      // Nothing
      setRoomBody("");
    }
  }, [language]);

  const SOCKET_SPEED = 100;
  const JAUDGE_API_KEY = process.env.REACT_APP_JAUDGE_API_KEY;
  const JAUDGE_HOST_LINK = process.env.REACT_APP_JAUDGE_LINK_HOST;
  const JAUDGE_API_URL = process.env.REACT_APP_API_URL;

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  // Once room will be created then this effect will triggered when ever props id changed
  useEffect(() => {
    socket.on("updateBody", (roomBody) => {
      setRoomBody(roomBody);
    });

    socket.on("updateInput", (input) => {
      setInput(input);
    });

    socket.on("updateLanguage", (language) => {
      setLanguage(language);
    });

    socket.on("updateOutput", (output) => {
      setOutput(output);
    });

    socket.on("updateRichText", (storeRaw) => {
      if (storeRaw) {
        const rawContentFromStore = convertFromRaw(JSON.parse(storeRaw));
        setEditorState(EditorState.createWithContent(rawContentFromStore));
      }
    });

    return () => {
      socket.off("updateBody", (roomBody) => {
        setRoomBody(roomBody);
      });
      socket.off("updateInput", (input) => {
        setInput(input.value);
      });
      socket.off("updateLanguage", (language) => {
        setLanguage(language.value);
      });
      socket.off("updateOutput", (output) => {
        setOutput(output.value);
      });
    };
  }, [props]);

  const GiveMeLanguageCode = () => {
    switch (language) {
      case "c":
        return 49;
      case "cpp":
        return 53;
      case "python":
        return 71;
      case "java":
        return 62;
      case "javascript":
        return 63;
      default:
        return 53;
    }
  };

  const submitHandler = () => {
    setLoader(true);

    if (submissionState === runningState) return;
    setSubmissionState(runningState);

    let language_code = parseInt(GiveMeLanguageCode(language));
    const encode_input = base64_encode(input);
    const encode_body = base64_encode(roomBody);
    var options = {
      method: "POST",
      url: `${JAUDGE_API_URL}/submissions`,
      params: { base64_encoded: "true", wait: "false", fields: "*" },
      headers: {
        "content-type": "application/json",
        "x-rapidapi-host": JAUDGE_HOST_LINK,
        "x-rapidapi-key": JAUDGE_API_KEY,
      },
      data: {
        language_id: language_code,
        source_code: encode_body,
        stdin: encode_input,
      },
    };

    axios
      .request(options)
      .then(function (response) {
        let token = response.data.token;

        setTimeout(() => {
          const ipString = `${JAUDGE_API_URL}/submissions/${token}`.toString();

          var ip = {
            method: "GET",
            url: ipString,
            params: { base64_encoded: "true", fields: "*" },
            headers: {
              "x-rapidapi-host": JAUDGE_HOST_LINK,
              "x-rapidapi-key": JAUDGE_API_KEY,
            },
          };

          axios
            .request(ip)
            .then(function (res) {
              if (res.data.status.description === "Accepted") {
                let decoded = base64_decode(res.data.stdout);
                // console.log("decoded", decoded);
                socket.emit("updateOutput", { value: decoded });
                setOutput(decoded);
              } else {
                let decoded = base64_decode(res.data.compile_output);
                // console.log("decoded", decoded);
                socket.emit("updateOutput", { value: decoded });
                setOutput(decoded);
              }
              setLoader(false);
              setSubmissionState("DONE");
            })
            .catch(function (err) {
              setLoader(false);
              console.error(err);
              setSubmissionState(err);
            });
        }, 5000);
      })
      .catch(function (error) {
        console.error(error);
        setLoader(false);
        setSubmissionState(error);
      });
  };

  const handleUpdateBody = (value) => {
    setRoomBody(value);
    debounce(() => socket.emit("updateBody", { value }), SOCKET_SPEED)();
  };

  const onEditorStateChange = (editorState) => {
    setEditorState(editorState);
    var contentRaw = convertToRaw(editorState.getCurrentContent());

    debounce(
      () =>
        socket.emit("updateRichText", {
          value: JSON.stringify(contentRaw),
        }),
      SOCKET_SPEED
    )();
  };

  const handleUpdateInput = (value) => {
    setInput(value);
    debounce(() => socket.emit("updateInput", { value }), SOCKET_SPEED)();
  };

  const HandleUpdateOutput = (value) => {
    setOutput(value);
    debounce(() => socket.emit("updateOutput", { value }), SOCKET_SPEED)();
  };

  const handleLanguage = (event) => {
    event.preventDefault();
    setLanguage(event.target.value);
    toast.success(`✨ Language changed to ${event.target.value} ✨`);
    debounce(
      () => socket.emit("updateLanguage", { value: event.target.value }),
      SOCKET_SPEED
    )();
  };

  const handleDownloadForIDE = () => {
    const new_file = new Blob([roomBody], { type: "text/plain;charset=utf-8" });
    const element = document.createElement("a");
    element.href = URL.createObjectURL(new_file);
    element.download = `${language}.${"txt"}`;
    document.body.appendChild(element);
    element.click();
  };

  const showFile = async (e) => {
    e.preventDefault();
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      setRoomBody(text);
    };
    reader.readAsText(e.target.files[0]);
  };

  const hiddenFileInput = React.useRef(null);

  const handleUpload = (e) => {
    hiddenFileInput.current.click();
  };

  return (
    <Loader
      show={loader}
      message={
        <div className="">
          <Digital size={55} />
        </div>
      }
    >
      <div style={{ margin: 0, height: "100%", overflow: "hidden" }}>
        <div className="flex flex-row justify-content-left">
          <div
            style={{
              width: "8%",
              marginTop: "6px",
              marginLeft: "1.8%",
            }}
          >
            <img
              alt="logo"
              src="./nav-logo.png"
              style={{ width: "100%" }}
            ></img>
          </div>
        </div>
        <hr className="mt-1" />
        <div className="grid grid-flow-row grid-cols-2 m0 room-body">
          <div className="">
            <div className="form-container">
              <div className="ide-container">
                <div className="center ide-low">
                  <div className="ide-header">
                    <h5 className="">
                      <svg
                        width="27"
                        height="23"
                        viewBox="0 0 27 23"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M11.633 22.155L9.08899 21.417C9.02566 21.3988 8.96655 21.3683 8.91505 21.3272C8.86355 21.2862 8.82068 21.2353 8.7889 21.1776C8.75712 21.1199 8.73705 21.0565 8.72986 20.991C8.72267 20.9255 8.72849 20.8592 8.74699 20.796L14.439 1.186C14.4572 1.12267 14.4877 1.06356 14.5287 1.01206C14.5698 0.960562 14.6207 0.91769 14.6784 0.885909C14.7361 0.854128 14.7995 0.834065 14.865 0.826872C14.9305 0.819679 14.9968 0.825499 15.06 0.843997L17.602 1.582C17.6653 1.60016 17.7244 1.63067 17.7759 1.67175C17.8274 1.71284 17.8703 1.7637 17.9021 1.8214C17.9339 1.87911 17.9539 1.94253 17.9611 2.00802C17.9683 2.0735 17.9625 2.13977 17.944 2.203L12.254 21.813C12.2358 21.8763 12.2053 21.9354 12.1642 21.9869C12.1231 22.0384 12.0723 22.0813 12.0146 22.1131C11.9569 22.1449 11.8934 22.1649 11.828 22.1721C11.7625 22.1793 11.6962 22.1735 11.633 22.155ZM6.87799 17.475L8.69199 15.54C8.73799 15.4912 8.77372 15.4337 8.79703 15.3708C8.82035 15.3079 8.83077 15.241 8.82769 15.174C8.82462 15.107 8.80809 15.0413 8.77911 14.9809C8.75013 14.9204 8.70927 14.8664 8.65899 14.822L4.88099 11.499L8.65899 8.175C8.70912 8.13065 8.74985 8.07668 8.77874 8.0163C8.80763 7.95591 8.8241 7.89035 8.82718 7.82348C8.83026 7.75661 8.81988 7.68981 8.79665 7.62702C8.77343 7.56424 8.73784 7.50677 8.69199 7.458L6.87799 5.522C6.83292 5.47388 6.77879 5.43515 6.7187 5.40804C6.65861 5.38092 6.59375 5.36596 6.52785 5.36401C6.46196 5.36206 6.39633 5.37316 6.33474 5.39667C6.27315 5.42018 6.21682 5.45563 6.16899 5.501L0.159985 11.132C0.11003 11.1788 0.0702066 11.2353 0.0429815 11.2981C0.0157564 11.3609 0.00170898 11.4286 0.00170898 11.497C0.00170898 11.5654 0.0157564 11.6331 0.0429815 11.6959C0.0702066 11.7587 0.11003 11.8152 0.159985 11.862L6.16999 17.496C6.21782 17.5414 6.27415 17.5768 6.33574 17.6003C6.39733 17.6238 6.46296 17.6349 6.52885 17.633C6.59475 17.631 6.65961 17.6161 6.7197 17.589C6.77979 17.5618 6.83392 17.5231 6.87899 17.475H6.87799ZM20.524 17.5L26.534 11.866C26.5839 11.8192 26.6238 11.7627 26.651 11.6999C26.6782 11.6371 26.6923 11.5694 26.6923 11.501C26.6923 11.4326 26.6782 11.3649 26.651 11.3021C26.6238 11.2393 26.5839 11.1828 26.534 11.136L20.524 5.498C20.4268 5.40761 20.2979 5.35914 20.1652 5.36307C20.0325 5.367 19.9067 5.42301 19.815 5.519L18.002 7.454C17.9561 7.50277 17.9205 7.56024 17.8973 7.62302C17.8741 7.68581 17.8637 7.75261 17.8668 7.81948C17.8699 7.88635 17.8863 7.95192 17.9152 8.0123C17.9441 8.07268 17.9848 8.12665 18.035 8.171L21.813 11.499L18.034 14.822C17.9838 14.8663 17.9431 14.9203 17.9142 14.9807C17.8853 15.0411 17.8689 15.1066 17.8658 15.1735C17.8627 15.2404 17.8731 15.3072 17.8963 15.37C17.9195 15.4327 17.9551 15.4902 18.001 15.539L19.815 17.474C19.8596 17.5225 19.9135 17.5617 19.9733 17.5894C20.0332 17.617 20.098 17.6325 20.1639 17.635C20.2298 17.6376 20.2955 17.627 20.3573 17.604C20.4191 17.581 20.4758 17.546 20.524 17.501V17.5Z"
                          fill="#EDEDED"
                        />
                      </svg>
                      <span>Code Here</span>
                    </h5>
                    <div className="float-right">
                      <div className="ml-2 mt-2 inline-block">
                        <div className="relative inline-flex">
                          <svg
                            class="ide-selectarrow pointer-events-none"
                            xmlns="http://www.w3.org/2000/svg"
                            width="13.819"
                            height="7.9"
                            viewBox="0 0 13.819 7.9"
                          >
                            <path
                              id="Icon_ionic-ios-arrow-back"
                              data-name="Icon ionic-ios-arrow-back"
                              d="M2.382,6.911,7.61,12.136a.988.988,0,1,1-1.4,1.395L.288,7.611A.986.986,0,0,1,.259,6.249L6.207.288a.988.988,0,0,1,1.4,1.395Z"
                              transform="translate(0 7.9) rotate(-90)"
                              fill="#828282"
                            />
                          </svg>
                          <select
                            className="ide-selectbox appearance-none"
                            defaultValue={language}
                            onChange={handleLanguage}
                          >
                            {languages.map((lang, index) => {
                              return (
                                <option
                                  key={index}
                                  value={lang}
                                  selected={lang === language}
                                >
                                  {lang}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                      <div className="ml-2 mt-2 inline-block">
                        <div className="relative inline-flex">
                          <svg
                            class="ide-selectarrow pointer-events-none"
                            xmlns="http://www.w3.org/2000/svg"
                            width="13.819"
                            height="7.9"
                            viewBox="0 0 13.819 7.9"
                          >
                            <path
                              id="Icon_ionic-ios-arrow-back"
                              data-name="Icon ionic-ios-arrow-back"
                              d="M2.382,6.911,7.61,12.136a.988.988,0,1,1-1.4,1.395L.288,7.611A.986.986,0,0,1,.259,6.249L6.207.288a.988.988,0,0,1,1.4,1.395Z"
                              transform="translate(0 7.9) rotate(-90)"
                              fill="#828282"
                            />
                          </svg>

                          <select
                            className="ide-selectbox appearance-none"
                            defaultValue={theme}
                            onChange={(event) => {
                              setTheme(event.target.value);
                              toast.success(
                                `🚀 Theme changed to ${event.target.value} 🚀`
                              );
                            }}
                          >
                            {themes.map((theme, index) => {
                              return (
                                <option key={index} value={theme}>
                                  {theme}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                      <div className="ml-2 mr-5 mt-2 inline-block">
                        <div className="relative inline-flex">
                          <svg
                            class="ide-selectarrow pointer-events-none"
                            xmlns="http://www.w3.org/2000/svg"
                            width="13.819"
                            height="7.9"
                            viewBox="0 0 13.819 7.9"
                          >
                            <path
                              id="Icon_ionic-ios-arrow-back"
                              data-name="Icon ionic-ios-arrow-back"
                              d="M2.382,6.911,7.61,12.136a.988.988,0,1,1-1.4,1.395L.288,7.611A.986.986,0,0,1,.259,6.249L6.207.288a.988.988,0,0,1,1.4,1.395Z"
                              transform="translate(0 7.9) rotate(-90)"
                              fill="#828282"
                            />
                          </svg>

                          <select
                            className="ide-selectbox appearance-none"
                            defaultValue={fontSize}
                            onChange={(event) =>
                              setFontSize(event.target.value)
                            }
                          >
                            {fontSizes.map((fontSize, index) => {
                              return (
                                <option key={index} value={fontSize}>
                                  {fontSize}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="ide-textarea">
                    <Editor
                      theme={theme}
                      language={languageToEditorMode[language]}
                      body={roomBody}
                      setBody={handleUpdateBody}
                      width={"100%"}
                      height={"47vh"}
                      fontSize={fontSize}
                    />
                    <div className="ide-bot-class">
                      <div className="ide-bottom-left">
                        <ul>
                          <li>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(roomBody);
                                toast.success(`🔥 Code has been Copied 🔥`);
                              }}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20.731"
                                height="23.693"
                                viewBox="0 0 20.731 23.693"
                              >
                                <path
                                  id="Icon_awesome-copy"
                                  data-name="Icon awesome-copy"
                                  d="M14.808,20.731v1.851A1.111,1.111,0,0,1,13.7,23.693H1.111A1.111,1.111,0,0,1,0,22.582V5.553A1.111,1.111,0,0,1,1.111,4.442H4.442v13.7a2.594,2.594,0,0,0,2.591,2.591Zm0-15.918V0H7.034A1.111,1.111,0,0,0,5.923,1.111V18.14A1.111,1.111,0,0,0,7.034,19.25H19.62a1.111,1.111,0,0,0,1.111-1.111V5.923H15.918A1.114,1.114,0,0,1,14.808,4.813Zm5.6-1.436L17.354.325A1.111,1.111,0,0,0,16.569,0h-.28V4.442h4.442v-.28a1.111,1.111,0,0,0-.325-.785Z"
                                  fill="#828282"
                                />
                              </svg>
                            </button>
                          </li>
                          <li>
                            <button onClick={handleDownloadForIDE}>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="25.385"
                                height="23.693"
                                viewBox="0 0 25.385 23.693"
                              >
                                <path
                                  id="Icon_metro-download2"
                                  data-name="Icon metro-download2"
                                  d="M22.033,14.01l-6.769,6.769L8.494,14.01h4.231V3.856H17.8V14.01Zm-6.769,6.769H2.571v6.769H27.956V20.779Zm11,3.385H22.879V22.472h3.385Z"
                                  transform="translate(-2.571 -3.856)"
                                  fill="#828282"
                                />
                              </svg>
                            </button>
                          </li>
                          <li>
                            <button onClick={handleUpload}>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="40.5"
                                height="35"
                                viewBox="0 0 18.385 14.693"
                                style={{ paddingTop: "10px" }}
                              >
                                {" "}
                                <path
                                  id="Icon_metro-upload2"
                                  data-name="Icon metro-upload2"
                                  d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"
                                  fill="#828282"
                                ></path>
                                <path
                                  id="Icon_metro-upload2"
                                  data-name="Icon metro-upload2"
                                  d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"
                                  fill="#828282"
                                ></path>
                              </svg>
                            </button>
                            <input
                              type="file"
                              ref={hiddenFileInput}
                              onChange={(e) => showFile(e)}
                              style={{ display: "none" }}
                            />
                          </li>
                        </ul>
                      </div>
                      <div className="ide-bottom-run">
                        <button
                          onClick={submitHandler}
                          disabled={submissionState === runningState}
                        >
                          Run
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className=" text-center ip-op-editor grid grid-flow-row grid-cols-2 m0">
                    <div className="ip-op-container">
                      <div className="header-ip-op">
                        <h5 className="Input">
                          Input{" "}
                          <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M21.0571 0.804993H2.6461C2.10395 0.806576 1.58446 1.02264 1.20111 1.406C0.817749 1.78936 0.601681 2.30885 0.600098 2.85099V6.93199H2.6461V2.82999H21.0571V17.18H2.6461V13.069H0.600098V17.169C0.601276 17.4364 0.655155 17.7009 0.758651 17.9474C0.862148 18.1939 1.01323 18.4176 1.20326 18.6057C1.39329 18.7938 1.61853 18.9425 1.86611 19.0435C2.11369 19.1444 2.37874 19.1956 2.6461 19.194H21.0571C21.5964 19.1964 22.1145 18.9845 22.4976 18.605C22.8808 18.2254 23.0975 17.7093 23.1001 17.17V2.85099C23.1002 2.58227 23.0474 2.31616 22.9446 2.06787C22.8418 1.81958 22.6911 1.59397 22.5011 1.40396C22.3111 1.21394 22.0855 1.06324 21.8372 0.960468C21.5889 0.857693 21.3228 0.804861 21.0541 0.804993H21.0571ZM10.8281 14.09L14.9201 9.99999L10.8281 5.90899V8.97699H0.600098V11.023H10.8281V14.09Z"
                              fill="#EDEDED"
                            />
                          </svg>
                        </h5>
                      </div>
                      <Editor
                        className="editor-1"
                        theme={theme}
                        language={""}
                        body={input}
                        setBody={handleUpdateInput}
                        fontSize={fontSize}
                      />
                    </div>
                    <div className="ip-op-container">
                      <div className="header-ip-op">
                        <h5 className="Output">
                          Output
                          <svg
                            width="18"
                            height="16"
                            viewBox="0 0 18 16"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M10.9101 15.85V13.668L2.18205 13.668L2.18205 2.75798L10.9101 2.75798V0.575975L5.53131e-05 0.575975L5.53131e-05 15.85L10.9101 15.85ZM13.0921 11.486L17.4561 8.21298L13.0921 4.93998L13.0921 7.12198L4.36405 7.12198L4.36405 9.30398L13.0921 9.30398V11.486Z"
                              fill="#EDEDED"
                            />
                          </svg>
                        </h5>
                      </div>
                      <Editor
                        className="editor-2"
                        theme={theme}
                        language={""}
                        body={output}
                        setBody={HandleUpdateOutput}
                        readOnly={true}
                        fontSize={fontSize}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="">
            <div className="wt-board">
              <WhiteBoard
                editorState={editorState}
                setEditorState={setEditorState}
                onEditorStateChange={onEditorStateChange}
              />
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </Loader>
  );
}

export default PlayGround;
