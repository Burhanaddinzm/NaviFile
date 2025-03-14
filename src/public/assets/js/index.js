"use strict";

const fsMainEl = document.querySelector(".fs-main");
const navUlEl = document.querySelector("header nav ul");
const fileViewerModal = document.getElementById("filev-mod");

fileViewerModal.addEventListener("mousedown", (e) => {
  if (e.target === fileViewerModal) {
    fileViewerModal.classList.add("hidden");
    document.body.style.overflow = "visible";
  }
});

const fetchLS = async (requestPath) => {
  try {
    const encodedPath = encodeURIComponent(requestPath);
    const response = await fetch(`/ls?path=${encodedPath}`);
    const data = await response.json();

    return data;
  } catch (error) {
    console.error(error);
  }
};

const fetchCat = async (requestPath) => {
  try {
    const encodedPath = encodeURIComponent(requestPath);
    const response = await fetch(`/cat?path=${encodedPath}`);
    const data = await response.json();

    return data;
  } catch (error) {
    console.error(error);
  }
};

const populateFileViewer = (data, name) => {
  const textEl = fileViewerModal.querySelector(".text");
  const nameEl = fileViewerModal.querySelector(".name");
  const lineNumbersEl = fileViewerModal.querySelector(".line-numbers");

  nameEl.textContent = `> ${name}`;
  textEl.textContent = data;

  lineNumbersEl.innerHTML = "";
  const lines = data.split("\n");
  lines.forEach((line, index) => {
    const span = document.createElement("span");
    span.textContent = index + 1;
    lineNumbersEl.appendChild(span);
  });
};

const populateNav = async (path) => {
  navUlEl.innerHTML = `<li><button class="nav-btn" data-path="/">/ (root)</button></li>`;

  const pathParts = path.split("/").filter((part) => part);
  let currentPath = "";

  for (const part of pathParts) {
    currentPath += `/${part}`;
    navUlEl.innerHTML += `&gt; <li><button class="nav-btn" data-path="${currentPath}/">${part}/</button></li>`;
  }

  const btns = navUlEl.querySelectorAll(".nav-btn");
  for (const button of btns) {
    const path = button.dataset.path;
    button.addEventListener("click", async () => await loadDir(path));
  }
};

const populateFsMain = async (data) => {
  fsMainEl.innerHTML = "";
  let htmlContent = "";

  for (const entry of data) {
    const { name, fullPath, path, permission, type, size, date, linkPath } =
      entry;
    const permArr = permission.split("");
    let addByte = false;

    if (!isNaN(parseInt(size[size.length - 1]))) addByte = true;

    htmlContent += `<li>
          <div class="fs-id">
            <img src="${
              type.includes("link")
                ? "./assets/images/link.svg"
                : type === "dir"
                ? "./assets/images/folder.svg"
                : "./assets/images/file.svg"
            }" alt="">
            <button id="content-btn" data-link-path="${
              type.includes("link") && linkPath !== null ? linkPath : ""
            }" data-path="${path}" data-full-path="${fullPath}" data-type="${type}">${name}</button>
          </div>
          <span>${size}${addByte ? "B" : ""}</span>
          <div>U:${permArr[0]} G:${permArr[1]} O:${permArr[2]}</div>
          <span>${date}</span>
          <div class="actions-container">
            <select name="actions" id="">
              <option value="move">Move</option>
              <option value="copy">Copy</option>
              <option value="delete">Delete</option>
              <option value="rename">Rename</option>
              <option value="chmod">Chmod</option>
            </select>
            <button>Act</button>
          </div>
        </li>`;
  }

  fsMainEl.innerHTML = htmlContent;
  const btns = fsMainEl.querySelectorAll("#content-btn");
  for (const btn of btns) {
    const btnPath = btn.dataset.fullPath;
    const btnType = btn.dataset.type;
    const linkPath = btn.dataset.linkPath;
    const name = btn.textContent;

    switch (btnType) {
      case "dir":
        btn.addEventListener("click", async () => await loadDir(btnPath));
        break;
      case "link-dir":
        if (linkPath) {
          btn.addEventListener("click", async () => await loadDir(linkPath));
        }
        break;
      case "link-file":
        if (linkPath) {
          btn.addEventListener(
            "click",
            async () => await loadFile(linkPath, name)
          );
        }
        break;
      case "file":
        btn.addEventListener(
          "click",
          async () => await loadFile(btnPath, name)
        );
        break;
    }
  }
};

const loadDir = async (requestPath) => {
  if (document.title !== requestPath) document.title = requestPath;
  const data = await fetchLS(requestPath);
  if (data.error) {
    console.error(data.error);
    if (data.error.includes("Permission denied"))
      alert("Permission denied! Try running the server with sudo.");

    return;
  }
  await populateNav(requestPath);
  await populateFsMain(data);
};

const loadFile = async (requestPath, name) => {
  const data = await fetchCat(requestPath);
  if (data.error) {
    console.error(data.error);
    if (data.error.includes("Permission denied"))
      alert("Permission denied! Try running the server with sudo.");

    return;
  }
  populateFileViewer(data, name);
  fileViewerModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
};

window.addEventListener("DOMContentLoaded", async () => await loadDir("/"));
