const  fs = require('fs');

if (process.argv.length < 3) {
    console.log('Usage: node clean_newlines.js <file>');
    process.exit(1);
}

const filePath = process.argv[2];

fs.readFile(filePath, 'utf8', function (err,data) {
    if (err) 
    {
        console.log(err);
        process.exit(1);
    }
    const result = data.replace(/\r\n/g, '\n');

    fs.writeFile(filePath, result, 'utf8', function (err) {
        if (err) 
        {
            console.log(err);
            process.exit(1);
        }
        console.log('Done.');
    });
});
