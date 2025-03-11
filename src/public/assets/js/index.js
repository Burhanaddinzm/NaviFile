"use strict";

const rootEl = document.querySelector("nav ul li:first-child");
const fsMainEl = document.querySelector(".fs-main");

const fetchLS = async (requestPath) => {
  try {
    const response = await fetch(
      `http://localhost:3000/ls?path=${requestPath}`
    );
    const data = await response.json();

    return data;
  } catch (error) {
    console.error(error);
  }
};

const populateFsMain = (data) => {
  fsMainEl.innerHTML = "";
  let htmlContent = "";

  for (const entry of data) {
    const { name, path, permission, type, size } = entry;
    const permArr = permission.split("");
    let addByte = false;

    if (!isNaN(parseInt(size[size.length - 1]))) addByte = true;

    htmlContent += `<li>
          <div class="fs-id">
            <img src="${
              type === "link"
                ? "./assets/images/link.svg"
                : type === "dir"
                ? "./assets/images/folder.svg"
                : "./assets/images/file.svg"
            }" alt="">
            <button>${name}</button>
          </div>
          <span>${size}${addByte ? "B" : ""}</span>
          <div>U:${permArr[0]} G:${permArr[1]} O:${permArr[2]}</div>
          <span>03/10/2025 02:52 PM</span>
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
};

rootEl.addEventListener("click", async () => {
  const requestPath = "/";
  document.title = requestPath;
  const rootData = await fetchLS(requestPath);
  populateFsMain(rootData);
});
