# Performance Budgets (budget.json)

Use a performance budget to prevent site performance from regressing over time.

## Usage

Performance budgets are supported in the CLI version of lighthouse. To use:
1. Create a `budget.json` file.
2. When running Lighthouse from the command line, pass the `--budget-path` (or `--budgetPath`) flag followed by the path to budget file in order to calculate whenever a category is over budget.
```
lighthouse https://youtube.com --budget-path=budget.json
```

## budget.json
The `budget.json` file is an array containing one or more `Budget` objects.

```json
[
  {
    "path": "/*",
    "options": {
       "firstPartyHostnames": ["*.my-site.com", "my-site.cdn.com"]
    },
    "timings": [
      {
        "metric": "interactive",
        "budget": 5000
      },
      {
        "metric": "first-meaningful-paint",
        "budget": 2000
      }
    ],
    "resourceSizes": [
      {
        "resourceType": "total",
        "budget": 500
      },
      {
        "resourceType": "script",
        "budget": 150
      }
    ],
    "resourceCounts": [
      {
        "resourceType": "third-party",
        "budget": 100
      }
    ]
  },
  {
    "options": {
       "firstPartyHostnames": ["*.my-site.com", "my-site.cdn.com"]
    },
    "path": "/checkout",
    "resourceSizes": [
      {
        "resourceType": "script",
        "budget": 200
      }
    ]
  }
]
``` 

## Further Explanation

### Timing Budgets

_Lighthouse 6 & up_

Use the optional `timings` property to define budgets for time-based performance metrics. In this context, budgets are defined in  milliseconds.

```json
"timings": [
   {
         "metric": "interactive",
         "budget": 5000
   }
]
```

Supported timing metrics:

- `first-contentful-paint`
- `first-cpu-idle`
- `interactive`
- `first-meaningful-paint`
- `max-potential-fid`
- `estimated-input-latency`
- `total-blocking-time`
- `speed-index`

### Resource Budgets

Use the optional `resourceSizes` property to define budgets for the *size* of page resources. In this context, budgets are defined in kilobytes.

```json
"resourceSizes": [
   {
      "resourceType": "script",
      "budget": 300
   }
]
```

Use the optional `resourceCounts` property to define budgets for the *quantity* of page resources. In this context, budgets are defined in # of requests.

```json
"resourceCounts": [
   {
      "resourceType": "script",
      "budget": 10
   }
]
```

Budgets can be set for the follow resource types.

*   `document`
*   `font`
*   `image`
*   `media`
*   `other`
*   `script`
*   `stylesheet`
*   `third-party`
*   `total`

### Using the `path` property

_Lighthouse 5.3 & up_

The `path` property indciates the pages that a budget applies to. This string should follow the [robots.txt](https://developers.google.com/search/reference/robots_txt#examples-of-valid-robotstxt-urls) format.

If `path` is not supplied, a budget will apply to all pages.

If a page's URL path matches the `path` property of more than one budget in `budget.json`, then the last matching budget will be applied. As a result, global budgets (e.g. `"path": "/*"`) should be listed first in `budget.json`, followed by the budgets that override the global budget (e.g. `"path": "/blog"`). 

Examples:

Match all URL paths.

`"path": "/"` (This is equivalent to writing `"path": "/*"`)

Match all URL paths starting with `/articles`.

`"path": "/articles"`

Match URL paths within the `uk/` directory and ending with `shopping-cart`.

`"path": "/uk/*/shopping-cart$"`

### Identification of third-party resources

_Lighthouse 6 & up_

`options.firstPartyHostnames` can be used to indicate which resources should be considered first-party. Wildcards can optionally be used to match a hostname and all of its subdomains.

If this property is not set, the root domain and all its subdomains are considered first party.

```json
"options": {
   "firstPartyHostnames": ["*.my-site.com", "my-site.cdn.com"]
}
```

Examples:
```
"firstPartyHostnames": ["pets.com"]
```
Result: pets.com is considerated first-party, but fishes.pets.com is not.

```
"firstPartyHostnames": ["*.pets.com"]
```
Result: Both pets.com and fishes.pets.com are considered first party.