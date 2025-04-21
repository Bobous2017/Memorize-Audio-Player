if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => {
        console.log("✅ Service Worker registered");
    }).catch(err => {
        console.warn("❌ Service Worker failed:", err);
    });
}

let files = [];
let currentIndex = 0;
let activeIndexes = [];
const repeatMap = {}; // { 2: 3, 4: 1, ... }
const trimMap = {}; // e.g., { 0: { start: 2.5, end: 5.0 }, 2: { start: 0, end: 4.3 } }✅ Step 1: Track start & end positions

const audio = document.getElementById('audio');
const fileInput = document.getElementById('fileInput');
const playlist = document.getElementById('playlist');

let isRepeating = false;
const repeatBtn = document.getElementById("repeatBtn");

const speedSlider = document.getElementById('speedSlider');
const speedLabel = document.getElementById('speedLabel');
let isLooping = false;
const loopBtn = document.getElementById("loopBtn");

// Update speed when the slider changes
speedSlider.addEventListener('input', () => {
    const rate = parseFloat(speedSlider.value);
    audio.playbackRate = rate;
    speedLabel.textContent = `${rate.toFixed(2)}x`;
});

//A repeat counter
let repeatCount = 0;
const repeatDisplay = document.createElement("span");
repeatDisplay.style.marginLeft = "5px";
repeatDisplay.style.color = "#00ff88";
repeatDisplay.style.fontWeight = "bold";
repeatDisplay.textContent = "";
repeatBtn.after(repeatDisplay);

function resetRepeatCounter() {
    repeatCount = 1;
    repeatDisplay.textContent = "";
    updatePlaylist();
}

function toggleRepeat() {
    isRepeating = !isRepeating;
    repeatBtn.classList.toggle('active', isRepeating);
    repeatBtn.textContent = isRepeating ? '🔁 Repeating' : '🔁 Repeat';
}

fileInput.addEventListener('change', () => {
    files = Array.from(fileInput.files);
    updatePlaylist();
    if (files.length) {
        loadTrack(0);
    }
});

function updatePlaylist() {
    playlist.innerHTML = '';
    files.forEach((file, index) => {
        const li = document.createElement('li');
        if (index === currentIndex) {
            li.classList.add('active');

            const countSpan = document.createElement('span');
            countSpan.style.marginLeft = "10px";
            countSpan.style.color = "#00ff88";
            countSpan.textContent = (isRepeating && repeatCount > 1) ? `🔁 x${repeatCount}` : "";

            li.appendChild(countSpan);
        }
        // Create checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('track-checkbox');
        checkbox.dataset.index = index;
        // If it's already selected, keep it checked
        checkbox.checked = activeIndexes.includes(index);
        // Update activeIndexes when clicked
        checkbox.onchange = () => {
            const idx = parseInt(checkbox.dataset.index);
            if (checkbox.checked) {
                if (!activeIndexes.includes(idx)) activeIndexes.push(idx);
            } else {
                activeIndexes = activeIndexes.filter(i => i !== idx);
            }
        };
        const span = document.createElement('span');
        span.textContent = file.name;

        if (isRepeating && repeatMap[index] && activeIndexes.includes(index)) {
            const countSpan = document.createElement('span');
            countSpan.style.marginLeft = '10px';
            countSpan.style.color = '#00ff88';
            countSpan.textContent = `🔁 x${repeatMap[index]}`;
            li.appendChild(countSpan);
        }

        //✅ Step 2: Render trim sliders in updatePlaylist()
        const trimContainer = document.createElement('div');
        trimContainer.classList.add('trim-container');


        const startSlider = document.createElement('input');
        startSlider.type = 'range';
        startSlider.min = 0;
        startSlider.max = audio.duration || 10; // update dynamically
        startSlider.step = 0.1;
        startSlider.value = trimMap[index]?.start || 0;

        const endSlider = document.createElement('input');
        endSlider.type = 'range';
        endSlider.min = 0;
        endSlider.max = audio.duration || 10; // update dynamically
        endSlider.step = 0.1;
        endSlider.value = trimMap[index]?.end || 10;

        // Store updated values
        // Left slider for start time
        let seekAfterSlider = false;

        startSlider.oninput = () => {
            trimMap[index] = trimMap[index] || {};
            const newStart = parseFloat(startSlider.value);
            const currentEnd = trimMap[index]?.end || audio.duration;

            // Keep at least 0.5s difference between start and end
            if (newStart >= currentEnd) {
                trimMap[index].start = Math.max(0, currentEnd - 0.5);
                startSlider.value = trimMap[index].start;
            } else {
                trimMap[index].start = newStart;
            }

            // Flag to seek after input is done
            if (index === currentIndex) {
                seekAfterSlider = true;
            }
        };
        // When user releases the slider (finished dragging), then seek
        startSlider.onchange = () => {
            if (seekAfterSlider && index === currentIndex) {
                audio.currentTime = trimMap[index].start;
                seekAfterSlider = false;
            }
        };
        // Right slider for Ending time
        endSlider.oninput = () => {
            trimMap[index] = trimMap[index] || {};
            trimMap[index].end = parseFloat(endSlider.value);
        };

        trimContainer.appendChild(startSlider);
        trimContainer.appendChild(endSlider);
        li.appendChild(trimContainer);

        li.appendChild(checkbox);
        li.appendChild(span);
        li.addEventListener('click', (e) => {
            // Ignore click if it's on a slider or checkbox
            if (e.target.tagName === 'INPUT') return;

            loadTrack(index);
        });
        playlist.appendChild(li);
    });
}
function loadTrack(index) {
    if (files[index]) {
        currentIndex = index;
        const fileURL = URL.createObjectURL(files[index]);
        audio.src = fileURL;
        audio.playbackRate = parseFloat(speedSlider.value);

        // ✅ Step 3: Use audio.currentTime to trim during playback
        // ✅ Step 4: Bonus: Adjust sliders’ max value to match audio duration
        audio.onloadedmetadata = () => {
            const duration = audio.duration;
            const trim = trimMap[currentIndex] || {};

            // fallback if trim not yet set
            if (!trim.start) trim.start = 0;
            if (!trim.end) trim.end = duration;

            trimMap[currentIndex] = trim;
            audio.currentTime = trim.start;

            updatePlaylist(); // only after we know duration
            audio.play();     // play after setting trim
        };

        resetRepeatCounter();
    }
}

//* Add event listeners
audio.addEventListener('timeupdate', () => {
    const trim = trimMap[currentIndex];
    if (!trim) return;

    if (audio.currentTime < trim.start) {
        audio.currentTime = trim.start;
        return;
    }

    if (audio.currentTime >= trim.end) {
        audio.pause();
        audio.dispatchEvent(new Event('ended')); // loop or next
    }
});


function playPause() {
    if (!files.length) return;
    if (audio.paused) {
        audio.play();
    } else {
        audio.pause();
    }
}

function stop() {
    audio.pause();
    audio.currentTime = 0;
}

function next() {

    if (activeIndexes.length > 0) {
        const currentInActive = activeIndexes.indexOf(currentIndex);
        const nextIndex = activeIndexes[(currentInActive + 1) % activeIndexes.length];
        loadTrack(nextIndex);
    } else if (currentIndex < files.length - 1) {
        loadTrack(currentIndex + 1);
    }
    // const currentInActive = activeIndexes.indexOf(currentIndex);

    // let nextIndex;
    // if (currentInActive === -1 || currentInActive === activeIndexes.length - 1) {
    //     // Restart from first active item
    //     nextIndex = activeIndexes[0];
    // } else {
    //     nextIndex = activeIndexes[currentInActive + 1];
    // }

    // loadTrack(nextIndex);
}
// Track the loop state
loopBtn.onclick = () => {
    isLooping = !isLooping;
    loopBtn.classList.toggle("active", isLooping);
    loopBtn.textContent = isLooping ? "🔂 Looping" : "🔂 Loop";
};

function prev() {
    if (currentIndex > 0) {
        loadTrack(currentIndex - 1);
    }
}

audio.addEventListener('ended', () => {
    if (isRepeating) {
        // Track-based repeat counter
        repeatMap[currentIndex] = (repeatMap[currentIndex] || 1) + 1;
        highlightGridCells(repeatMap[currentIndex]);

        repeatDisplay.textContent = `🔁 x${repeatMap[currentIndex]}`;
        updatePlaylist();

        // Move to next if multiple selected
        if (activeIndexes.length > 1) {
            const currentInActive = activeIndexes.indexOf(currentIndex);
            const nextIndex = activeIndexes[(currentInActive + 1) % activeIndexes.length];
            loadTrack(nextIndex);
        } else {
            // Only one item is active, so loop it
            audio.currentTime = 0;
            audio.play();
        }

    } else {
        resetRepeatCounter();
        //next();
        const isLastTrack =
            (activeIndexes.length > 0 && currentIndex === activeIndexes[activeIndexes.length - 1]) ||
            (activeIndexes.length === 0 && currentIndex === files.length - 1);

        if (isLastTrack && isLooping) {
            // Go back to first item
            const firstIndex = activeIndexes.length > 0 ? activeIndexes[0] : 0;
            loadTrack(firstIndex);
        } else {
            next();
        }
    }

});

// === Drag & Drop ===
playlist.addEventListener("dragover", (e) => {
    e.preventDefault();
    playlist.classList.add("dragover");
});

playlist.addEventListener("dragleave", () => {
    playlist.classList.remove("dragover");
});

playlist.addEventListener("drop", (e) => {
    e.preventDefault();
    playlist.classList.remove("dragover");

    let droppedFiles = [];
    const items = e.dataTransfer.items;

    for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry && entry.isDirectory) {
            const dirReader = entry.createReader();
            dirReader.readEntries(entries => {
                for (const fileEntry of entries) {
                    fileEntry.file(file => {
                        if (file.type.startsWith("audio")) {
                            droppedFiles.push(file);
                            files.push(file);
                            updatePlaylist();
                        }
                    });
                }
            });
        } else {
            const file = item.getAsFile?.();
            if (file && file.type.startsWith("audio")) {
                droppedFiles.push(file);
            }
        }
    }

    // If they aren't folders
    if (!items[0]?.webkitGetAsEntry?.()?.isDirectory) {
        const fileList = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("audio"));
        files = files.concat(fileList);
        updatePlaylist();
    }

    if (!audio.src && files.length) loadTrack(0);
});

playlist.addEventListener("wheel", (e) => {
    console.log("🎯 Wheel event fired!");
    console.log("altKey:", e.altKey);

    // if (!e.altKey) {
    //     console.log("❌ Alt key not held. Ignoring.");
    //     return;
    // }

    e.preventDefault(); // stop list from scrolling
    console.log("✅ Alt + wheel detected. Trying reorder...");

    const hovered = document.elementFromPoint(e.clientX, e.clientY);
    if (!hovered || hovered.tagName !== 'LI') {
        console.log("❌ No list item hovered.");
        return;
    }

    const li = hovered;
    const index = Array.from(playlist.children).indexOf(li);
    console.log("Hovered index:", index);

    if (index === -1) {
        console.log("❌ Couldn't determine hovered index.");
        return;
    }

    const direction = e.deltaY > 0 ? 1 : -1;
    const targetIndex = index + direction;

    if (targetIndex >= 0 && targetIndex < files.length) {
        console.log(`🔁 Swapping index ${index} with ${targetIndex}`);
        [files[index], files[targetIndex]] = [files[targetIndex], files[index]];

        if (index === currentIndex) currentIndex = targetIndex;
        else if (targetIndex === currentIndex) currentIndex = index;

        updatePlaylist();
    } else {
        console.log("⚠️ Swap target out of bounds.");
    }
}, { passive: false });

// Grid Dynamically Add Rows or Columns
const grid = document.querySelector('.number-grid');
for (let i = 0; i < 14; i++) {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = '';
    grid.appendChild(input);
}

// highlightGridCells(repeatCount); // Call this function to highlight cells based on repeatCount
const chime = new Audio("sounds/chime.wav");

function highlightGridCells(repeatCount) {
    const cells = document.querySelectorAll('.number-grid input');
    cells.forEach(cell => {
        const value = parseInt(cell.value);
        if (value === repeatCount) {
            cell.classList.add('highlighted');
            navigator.vibrate?.([200, 100, 200]); // vibrate if supported
            chime.currentTime = 0;
            chime.play().catch(() => { }); // silently fail on auto restrictions
        }
    });
}

document.querySelector('.theme-toggle').onclick = () => {
    document.querySelector('.theme-selector').classList.toggle('open');
};

document.querySelectorAll('.theme-option').forEach(option => {
    option.onclick = () => {
        const theme = option.getAttribute('data-theme');
        const container = document.querySelector('.player-container');

        // Clear old themes
        container.classList.remove('theme-purple', 'theme-amber', 'theme-neon', 'theme-blue', 'theme-green');
        container.classList.add(`theme-${theme}`);

        document.querySelector('.theme-selector').classList.remove('open');
    };
});
