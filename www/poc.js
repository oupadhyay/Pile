// Import Capacitor plugins
const { Filesystem, Directory } = capacitorExports['@capacitor/filesystem'];
const { Dialog } = capacitorExports['@capacitor/dialog'];
const { Toast } = capacitorExports['@capacitor/toast'];

// Output div
const outputDiv = document.getElementById('output');

// Function to log messages to both console and output div
function log(message) {
    console.log(message);
    if (typeof message === 'object') {
        outputDiv.innerHTML += JSON.stringify(message, null, 2) + '<br>';
    } else {
        outputDiv.innerHTML += message + '<br>';
    }
}

// --- Filesystem Tests ---
async function testFilesystem() {
    try {
        log('--- Starting Filesystem Test ---');

        // Write a file
        await Filesystem.writeFile({
            path: 'poc-test.txt',
            data: 'Hello from Capacitor Filesystem!',
            directory: Directory.Data,
            encoding: 'utf8',
        });
        log('File written: poc-test.txt');

        // Read the file
        const readFileResult = await Filesystem.readFile({
            path: 'poc-test.txt',
            directory: Directory.Data,
            encoding: 'utf8',
        });
        log('File content: ' + readFileResult.data);

        // List files in Directory.Data
        const readdirResult = await Filesystem.readdir({
            path: '', // Read the root of the Directory.Data
            directory: Directory.Data,
        });
        log('Files in Directory.Data:');
        log(readdirResult.files);

        // Clean up - delete the file
        await Filesystem.deleteFile({
            path: 'poc-test.txt',
            directory: Directory.Data,
        });
        log('File deleted: poc-test.txt');

        log('--- Filesystem Test Completed ---');
    } catch (error) {
        log('Filesystem Test Error: ' + JSON.stringify(error));
    }
}

// --- AI API Call Test (Fetch) ---
async function testFetch() {
    try {
        log('--- Starting Fetch API Test ---');
        const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
        if (!response.ok) {
            throw new Error('Network response was not ok: ' + response.statusText);
        }
        const data = await response.json();
        log('Fetch API Response:');
        log(data);
        log('--- Fetch API Test Completed ---');
    } catch (error) {
        log('Fetch API Test Error: ' + error.message);
    }
}

// --- Button Event Listener for Dialog and Toast ---
document.getElementById('testButton').addEventListener('click', async () => {
    try {
        log('--- Button Clicked - Testing Dialog and Toast ---');

        // Show alert dialog
        await Dialog.alert({
            title: 'PoC Test',
            message: 'Dialog works!',
        });
        log('Dialog shown and dismissed.');

        // Show toast notification
        await Toast.show({
            text: 'Toast works!',
        });
        log('Toast shown.');

        log('--- Dialog and Toast Test Completed ---');
    } catch (error) {
        log('Dialog/Toast Test Error: ' + JSON.stringify(error));
    }
});

// Run tests on load
(async () => {
    // Filesystem plugin might need platform-specific setup,
    // so it's better to call it after the platform is ready.
    // For now, we'll call it directly.
    // In a real app, use Capacitor's `Plugins.ready` or similar.
    await testFilesystem();
    await testFetch();
    log('All initial tests called. Click the button to test Dialog and Toast.');
})();
