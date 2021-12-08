const vscode = acquireVsCodeApi();

// const vscode = {
//     postMessage: function(message) {
//         console.log(message);
//     }
// };

function handleCheckbox(cbx) {
    if (cbx.name === "input")
    {
        const id = document.getElementById("input-type").value === "text" ? "input-list" : "input-file";
        document.getElementById(id).style["display"] = cbx.checked ? "block" : "none";
        vscode.postMessage({
            command: cbx.name,
            value: cbx.checked ? id : ""
        });
    }
    else
    {
        vscode.postMessage({
            command: cbx.name,
            value: cbx.checked
        });
    }
}

function updateFile(input)
{
    // vscode.postMessage({
    //     command: "input-value",
    //     value: input.files
    // });
    vscode.postMessage({
        command: "input-value",
        value: input.value
    });
}

function handleCheckboxNumber(cbx, nmb, change) {
    cbx = document.getElementById(cbx);
    nmb = document.getElementById(nmb);
    if(cbx.checked) {
        if(nmb.value === "") {
            nmb.value = 1;
        }
        vscode.postMessage({
            command: cbx.name,
            value: parseInt(nmb.value)
        });
    }
    else if(change) {
        vscode.postMessage({
            command: cbx.name,
            value: -1
        });
    }
}

function updateInputType(selectObect)
{
    if (!document.getElementById("i").checked)
    {
        return;
    }
    const list = document.getElementById("input-list");
    const file = document.getElementById("input-file");
    if(selectObect.value === "text") {
        list.style["display"] = "block";
        file.style["display"] = "none";
        vscode.postMessage({
            command: "input",
            value: "input-list"
        });
    }
    else {
        list.style["display"] = "none";
        file.style["display"] = "block";
        vscode.postMessage({
            command: "input",
            value: "input-file"
        });
    }
}

function autoGrow(element) {
    element.style.height = "5px";
    element.style.height = (element.scrollHeight)+"px";
}

function addInput()
{
    const list = document.getElementById("input-list");
    let newRow = document.createElement("div");
    newRow.className = "input-row";
    let keyInput = document.createElement("input");
    keyInput.className = "input-key";
    keyInput.type = "text";
    keyInput.name = "key";
    keyInput.placeholder = "Key";
    newRow.appendChild(keyInput);

    let arrow = document.createElement("span");
    arrow.className = "input-arrow";
    arrow.innerHTML = "|->";
    newRow.appendChild(arrow);

    let valueInput = document.createElement("textarea");
    valueInput.className = "input-value";
    valueInput.type = "text";
    valueInput.name = "value";
    valueInput.oninput = function() {
        autoGrow(valueInput);
        vscode.postMessage({
            command: "input-value",
            value: {
                key: keyInput.value,
                value: valueInput.value
            }
        });
    };
    newRow.appendChild(valueInput);
    // keyInput.oninput = function() {
    //     vscode.postMessage({
    //         command: "input-value",
    //         value: {
    //             key: keyInput.value,
    //             value: valueInput.value
    //         }
    //     });
    // };
    let removeButton = document.createElement("button");
    removeButton.className = "input-button";
    removeButton.innerHTML = "Remove";
    removeButton.onclick = function() {
        list.removeChild(newRow);
        vscode.postMessage({
            command: "input-value",
            value: {
                key: keyInput.value,
                value: ""
            }
        });
    };
    newRow.appendChild(removeButton);
    list.appendChild(newRow);
}

function saveInput()
{
    vscode.postMessage({
        command: "save",
    });
}