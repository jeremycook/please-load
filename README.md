# please-load

Politely and asynchronously loads JS, CSS, HTML fragments, and other dependencies into web browsers.

# Getting Started

1. Add `please-load.js` to your HTML like in this simple example document.

> Note that `data-config` is required and `data-cache-buster` is recommended. The cache buster value is appended to URLs when loading files.

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Please Load Example</title>
    <link href="/lib/app/app.css" rel="stylesheet" />
    <script src="/lib/please-load/please-load.js" 
            data-config="/lib/please.json"
            data-cache-buster="{{ server_side_cache_buster }}"></script>
</head>
<body>
    <script>
        please.load("app/app.js", function () {
            $("body").text("app.js and anything it depends on has loaded!");
        });
    </script>
</body>
</html>
```

2. Add a `please.json` file.

> Note that all file paths are relative to the folder that the `please.json` file is in. This means you could put please.json in the root of your site and have file paths like `lib/jquery/jquery.min.js` or you could place it in your lib folder and have slightly shorter file paths like `jquery/jquery.min.js`. Paths containing  "../" are not resolved automatically. So it would make since to put please.json at the root of your website if you have dependencies in more than one folder under the root of your website (folders like /css and /js for example).

**Example /lib/please.json**

```json
{
  "libs": {
    "app/app.css": {
      "loaded": true
    },
    "app/app.js": {
      "deps": [ "jquery", "app/app.css" ]
    },
    "jquery": {
      "file": "jquery/jquery.min.js"
    }
  }
}
```

