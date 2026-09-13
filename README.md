# Roadroller: Flattens Your JavaScript Demo

**Roadroller** is a heavyweight JavaScript packer for large [demos][demo]. It was originally designed for [js13kGames], but it remains usable for demos as small as 4KB. Depending on the input it can provide up to 15% additional compression compared to best ZIP/gzip recompressors. **[Try it online][online]!**

Roadroller is considered "heavyweight" unlike typical JS packers such as [JSCrush] or [RegPack], because it is quite resource intensive and requires both a considerable amount of memory and a non-negligible run time. The default should work for most devices, but you can configure both aspects as you need.

## Quick Start

In addition to the [online demo][online], Roadroller is available as an [NPM package][npm]:

```
$ npx roadroller input.js -o output.js
```

You can also use Roadroller as a library to integrate with your build pipeline.

```javascript
import { Packer } from 'roadroller';

const inputs = [
    {
        data: 'console.log("Hello, world!");',
        type: 'js',
        action: 'eval',
    },
];

const options = {
    // see the Usage for available options.
};

const packer = new Packer(inputs, options);
await packer.optimize(); // takes less than 10 seconds by default

const { firstLine, secondLine } = packer.makeDecoder();
console.log(firstLine + secondLine);
```

Roadroller as a library or a CLI command requires Node.js 14 or later. Node.js 16 is strongly recommended because Roadroller is substantially faster in 16 than in 14.

## Usage

By default Roadroller receives your JS code and returns a compressed JS code that should be further compressed with ZIP, gzip or PNG bootstrap (or more accurately, [DEFLATE]). Ideally your JS code should be already minified, probably using [Terser] or [Closure Compiler]; Roadroller only does a minimal whitespace and comment suppression.

The resulting code will look like this: (the newline is mostly for the explanation and can be removed)

```javascript
eval(Function("[M='Zos~ZyF_sTdvfgJ^bIq_wJWLGSIz}Chb?rMch}...'"
,...']charCodeAtUinyxp',"for(;e<12345;c[e++]=p-128)/* omitted */;return o")([],[],12345678,/* omitted */))
```

The first line is a compressed data. It can contain control characters like `` (U+001C) that might not render in certain environments. Nevertheless you should make sure that they are all copied in verbatim.

The second line is a compressor tuned for this particular input. By default the decompressed data immediately goes through `eval`, but you can configure what to do with that.

The first line is very incompressible unlike the second line, so ideally you should compress two lines separately. This is best done by using ADVZIP from [AdvanceCOMP] or [ECT]. The first line and second line may form a single statement as above so they should not be separated; you can only put whitespace between them.

<!--
### Multiple Inputs

You can also give multiple inputs to Roadroller; for example you can put shaders and map data. The executed code will receive all decompressed inputs. This is more efficient than putting them into strings because each input can be separately modelled.
-->

### Input Configuration

Each input can be further configured by input type and action. In the CLI you put corresponding options *before* the file path.

**Input type** (CLI `-t|--type TYPE`, API `type` in the input object) determines the preprocessing step to improve the compression. <!--Dropping a file to the input window also tries to detect the correct input type.-->

* **JavaScript** (`js`) assumes a valid JS code. Automatically removes all redundant whitespace and comments and enables a separate modelling for embedded strings. This also works for JSON.

<!--* **GLSL** (`glsl`) assumes a valid GLSL code. Automatically removes all redundant whitespace and comments.-->

<!--* **HTML** (`html`) assumes a valid HTML. (TODO)-->

* **Text** (`text`) assumes a human-readable Unicode text that can be encoded in UTF-8. This can also be used for JavaScript code that should not undergo preprocessing.

<!--* **Binary** (`binary`) does nothing. You can choose base64 (`binary:base64`) or hex (`binary:hex`) for the input encoding.-->

**Input action** (CLI `-a|--action ACTION`, API `action` in the input object) determines what to do with the decompressed data. <!--All action except for the evaluate produces a value to the variable named `_` by default, which is either a value itself for a single input and an array of values for multiple inputs.-->

* <!--*(JS, text only)*-->
  **Evaluate** (`eval`) evaluates the decompressed JavaScript code. If there are multiple inputs there should be exactly one JavaScript input with evaluate action, since subsequent inputs will be decompressed in that code. The resulting value is always a code string, which may include decoders for subsequent inputs.

<!--* *(JS, text only)* **JSON decode** (`json`) parses and returns a JSON value with `JSON.parse`.-->

<!--* *(No binary)* **String** (`string`) returns a string.-->

* <!--*(No binary)*-->
  **Write to document** (`write`) writes a decompressed string to `document`. Typically used with HTML.

<!--* **Array** (`array`) returns an array of bytes.-->

<!--* **Typed array** (`u8array`) returns a `Uint8Array` value.-->

<!--* **Base64** (`base64`) returns a base64-encoded string. Handy for data URIs.-->

<!--
**Input name** (CLI `-n|--name NAME`, API `name`) is required for accessing each input from the decompressed code. This is required if the input produces an output value.

**Extract inputs** (CLI `-x|--extract`, not available in API) can be used for the JavaScript input with the evaluate action. This will try to extract long embedded strings and determine the best type for each input. This assumes that the compressed code doesn't make use of the output variable elsewhere; you can change the variable name from the configuration.
-->

### Output Configuration

**Number of contexts** (CLI `-S|--selectors xCOUNT`) relates to the complexity of modelling. The larger number of contexts will compress better, but at the expense of linear increase in both the time and memory usage. The default is 12, which targets at most 1 second of latency permitted for typical 30 KB input.

**Maximum memory usage** (CLI `-M|--max-memory MEGABYTES`, API `maxMemoryMB` in the options object) controls the memory budget for model context tables, including the extra word model when SSE is enabled. Auxiliary mixer weights are additional. Higher values may improve compression at the cost of substantially higher decompression memory usage and allocation time.

Memory values use decimal megabytes: 1 MB = 1,000,000 bytes. The requested memory value is a budget rather than an exact allocation. Context tables use power-of-two capacities, so multiple memory budgets may select the same table size. Use `-v` to print the actual context-table memory usage to stderr.

Useful starting points:

- **150 MB:** conservative.
- **500 MB:** default; more compression-focused where memory use is less constrained.
- **1000 MB:** size-focused; a good balance for memory-tolerant sizecoding.
- **2000 MB:** aggressive size-first setting.

```sh
# Conservative
roadroller -M150 input.js -o packed.js

# Default (more compression-focused)
roadroller -M500 input.js -o packed.js

# Size-focused
roadroller -M1000 input.js -o packed.js

# Aggressive
roadroller -M2000 input.js -o packed.js
```

The CLI accepts budgets from 100 to 4000 MB. Larger tables do not guarantee smaller output, so compare the final compressed archive when choosing a value.

**Allowing the decoder to pollute the global scope** (CLI `-D|--dirty`, API `allowFreeVars` in the options object) is unsafe especially when the Roadroller output should coexist with other code or there are elements with single letter `id` attributes and turned off by default. But if you can control your environment (typical for demos), you can turn this on for a smaller decoder.

**Optimize parameters** (CLI `-O|--optimize LEVEL`, API `Packer.optimize`) searches for better modelling parameters. If parameters are already given the optimizer will try to improve upon that, and the optimizer prints best parameters at the end which can be reused for faster iteration. Parameters are solely related to the compression ratio so you can try this as many as you can afford. Each level does the following:

* Level 0 does absolutely nothing and uses given parameters or default parameters if none. This is the default when any optimizable parameters are given.

* Level 1 runs a quick search with about 30 sets of parameters and takes less than 10 seconds for typical 30 KB input. This is the default when no optimizable parameters are given, and intended for the typical build process.

* Level 2 runs a thorough search with about 300 sets of parameters and takes about a minute or two. This is best useful for the release build and you would like to save best parameters for later uses.

* Level ∞ is a special option only available in the CLI (`-OO`, with two capital Ohs) and runs increasingly slower optimizations in a run. Once the highest level is reached it runs that level forever. You need to explicitly terminate the search (e.g. CTRL-C), then it will proceed with the best parameters so far.

### Advanced Configuration

**Number of context bits** (CLI `-Zco|--context-bits BITS`, API `contextBits` in the options object) sets the size of individual model as opposed to the total memory use (`-M`), which is a product of the number of context and the size of each model. This explicit option is most useful for the fair benchmarking, since some parameters like `-Zpr` or `-Zmc` affect the memory use and therefore this parameter.

<!--**Optimize for uncompressed size** (CLI `--uncompressed-only`) assumes the absence of the outer comperssion algorithm like DEFLATE. This is *bad* for the compression since the compressor has to work strictly within the limits of JS source code including escape sequences. This should be the last resort where you can't even use the PNG-based self extraction and everything has to be in a single file.-->

> Following parameters can be automatically optimized and normally you don't have to touch them unless you want to reproduce a particular set of parameters. As such, the default optimization (`-O1`) is disabled if any of these arguments are given in the CLI.

**Chosen contexts** (CLI `-S|--selectors SELECTOR,SELECTOR,...`, API `sparseSelectors` in the options object) determine which byte contexts are used for each model. <i>K</i>th bit of the number (where K > 0) is set if the context contains the <i>K</i>th-to-last byte: 5 = 101<sub>(2)</sub> for example would correspond to the context of the last byte and third-to-last byte, also called a sparse context (0,2). There is no particular limit for the number, but Roadroller only considers up to 9th order for the optimization process.

**Precision** (CLI `-Zpr|--precision BITS`, API `precision` in the options object) is the number of fractional bits used in the internal fixed point representation. This is shared between the entropy coder and context models and can't be decoupled. The default of 16 should be enough, you can also try to decrease it.

**Learning rate** (CLI `-Zlr|--learning-rate RATE`, API `recipLearningRate` in the options object) adjusts how fast would the context mixer adapt, where smaller is faster. The default is 500 which should be fine for long enough inputs. If your demo is smaller than 10 KB you can also try smaller numbers.

The optimizer also searches the ordinary and pair learning rates together, keeping `recipLearningRate / pairRecipLearningRate` at integer factors 1 through 6 (plus the current integer factor, if within the search bounds). These ratios produce short multipliers in the generated decoder. Level 1 samples a few scales for each factor; higher levels refine each scale locally. Independent rate searches then allow non-integer ratios to win when they produce a better score. The existing rate options retain their meanings.

**Secondary symbol estimation** (CLI `--sse`, API `sse: true`, default `false`) adds a compact correction to the mixed prediction in logit space. It uses eight wrapping buckets with no interpolation, trained by the current byte prefix and previous byte. SSE also adds a rolling word-context model (bytes 65–122), a `.1` mixer bias, and a tuned terminal-state offset for 6-bit rANS output. Count tables automatically use the narrowest safe array. SSE shares a padded mixer weights array and increases decoder size and auxiliary memory; measure the final archive to decide whether it helps. The context-table memory estimate does not include these auxiliary mixer weights. SSE uses the JavaScript encoder rather than the existing WASM runner and stays fixed during parameter search. Reported CLI parameters retain `--sse` so they reproduce the selected mode.

**Optimization wrappers** (CLI `--optimize-wrapper FILE`, API `optimizePrefix` and `optimizeSuffix`) supply the surrounding content when scoring a candidate. The wrapper file must contain exactly one `__ROADROLLER__` marker, for example `<script>__ROADROLLER__</script>`. The CLI currently requires `--zopfli` for this option:

```sh
roadroller --zopfli --optimize-wrapper page-wrapper.html -O1 input.js -o packed.js
```

The optional `node-zopfli-es` dependency is loaded by the CLI only when `--zopfli` is requested.

The wrapper affects scoring only: `packed.js` and `makeDecoder()` still contain only Roadroller output. The legacy size estimator remains unchanged and does not score wrapper content.

Custom API scorers now receive `optimizeScore(input, packed, options)`, where `input` is exactly `optimizePrefix + packed.firstLine + packed.secondLine + optimizeSuffix`. This replaces the previous `(packed, options)` callback signature. A scorer may return a number or an object with `valueOf()` and `compare(other)` methods. `createZopfliPackedScore()` from `zopfli.mjs` accepts this complete input, comparing candidates first at 1 iteration. Differences greater than 8 bytes use that quick result; candidates within 8 bytes are compared at 100 iterations. Candidates within 4 bytes at 100 iterations are compared at 1000 iterations, with remaining ties broken by UTF-8 input length. Numeric score conversions still use the 1-iteration result.

Sparse-selector annealing uses the same adaptive comparison as global-best selection, reusing cached compression results. Better or equal moves are always accepted; worse moves are accepted with probability `exp(-delta / (6 * temperature))`, where `delta` is the comparison's size difference. Custom score objects should therefore return a size difference from `compare(other)`, rather than only a sign. The cooling rate and selector mutation distribution are unchanged.

Optimization logs show `12775` for a candidate with only a 1-iteration result, `12758/12751` for cached 1/100-iteration results, or `12755/12752/12750` for cached 1/100/1000-iteration results. Logging never triggers the stronger compression passes. API progress exposes these optional cached results as `currentSize100` and `currentSize1000`, while `currentSize` remains the numeric quick score.

**Model max count** (CLI `-Zmc|--model-max-count COUNT`, API `modelMaxCount` in the options object) adjusts how fast would individual contexts adapt, where smaller is faster. The model adapts fastest when a particular context is first seen, but that process becomes slower as the context is seen multiple times. This parameter limits how slowest the adaptation process can be. The default of 5 is specifically tuned for JS code inputs.

**Model base divisor** (CLI `-Zmd|--model-base-divisor DIVISOR`, API `modelRecipBaseCount` in the options object) adjusts how fast should individual contexts adapt *initially*, where larger is faster. The optimal value typically ranges from 10 to 100 for JS code inputs.

**Dynamic model flags** (CLI `-Zdy|--dynamic-models FLAGS`, API `dynamicModels` in the options object) are used to enable or disable specific dynamic models, where each bit is turned on if the model is in use. There is currently one supported model:

* The bit 0 (value 1) models quoted strings (', " or \`) and works well for source codes. It assumes that every quotes are paired, so it can't be used in English texts with contractions (e.g. isn't) and turned off by default in non-JS inputs.

**Number of abbreviations** (CLI `-Zab|--num-abbreviations NUM`, API `numAbbreviations` in the options object) affects the preprocessing for JS code inputs. Common identifiers and reserved words can be abbreviated to single otherwise unused bytes during the preprocessing; this lessens the burden of context modelling which can only look at the limited number of past bytes. If this parameter is less than the number of allowable abbreviations some identifiers will be left as is, which can sometimes improve the compression.

### Tips and Tricks

* The current algorithm slightly prefers 7-bit and 8-bit inputs for the decoder simplicity. You can still use emojis and other tricks that stuff many bits into Unicode code points, but the compression ratio might be decreased. Keep in mind that Roadroller is already doing the hard work for you and you might not need to repeat that.

* The compressed JS code doesn't do anything beyond computation and the final action, so you can do anything before or after that. The [online demo][online] for example inserts a sort of splash screen as a fallback.

* Roadroller, while being super effective for many inputs, is not a panacea. Roadroller is weaker at exploiting the duplication at a distance than DEFLATE. Make sure to check ADVZIP or ECT out.

See also the [wiki] for more information.

## Compatibility

Roadroller itself and resulting packed codes are ECMAScript 2015 (ES6) compatible and should run in every modern Web browser and JS implementation. Implementations are assumed to be reasonably fast but otherwise it can run in slower interpreters. MSIE is not directly supported but it works fine (slowly) after simple transpiling.

Roadroller and packed codes extensively use `Math.exp` and `Math.log` that are [implementation-approximated](https://262.ecma-international.org/#implementation-approximated), so there is a small but real possibility that they behave differently in different implementations. This is known to be a non-issue for browser JS engines as well as V8 and Node.js as they use the same math library (fdlibm) for those functions, but you have been warned.

## Internals

Roadroller is mostly possible due to the progress in data compression algorithms as recent as 2010s:

* Bytewise [rANS] coder, adapted from Fabien Giesen's [public domain code][ryg_rans].

* [Logistic context mixing], which is a type of neural network specifically designed for the data compression.

* Sparse context models up to 9th order. Models are tuned for each input with simulated annealing. (You may have noticed that this entire architecture is similar to [Crinkler], but Roadroller uses a faster and possibly better parameter search algorithm.)

The minimal JS code for this algorithm was initially adapted from a [golf.horse submission](http://golf.horse/wordlist.asc/contextually-F81hkL3e5HgGOj4bhaSfXIGSI0DSTkb5n58Qqc6NFmc) by Hasegawa Sayuri (public domain). The main difference is that Roadroller implements hashed contexts and thus order 3+ context models.

## License

The Roadroller compressor proper is licensed under the MIT license. In addition to this, any decoder code produced by Roadroller, that is, everything in the second line is put in the public domain.

[npm]: https://www.npmjs.com/package/roadroller
[online]: https://lifthrasiir.github.io/roadroller/
[wiki]: https://github.com/lifthrasiir/roadroller/wiki

[js13kGames]: https://js13kgames.com/

[JSCrush]: http://www.iteral.com/jscrush/
[RegPack]: https://siorki.github.io/regPack.html
[Terser]: https://terser.org/
[Closure Compiler]: https://closure-compiler.appspot.com/home
[AdvanceCOMP]: http://www.advancemame.it/comp-readme
[ECT]: https://github.com/fhanau/Efficient-Compression-Tool/
[Crinkler]: https://github.com/runestubbe/Crinkler
[ryg_rans]: https://github.com/rygorous/ryg_rans/

[demo]: https://en.wikipedia.org/wiki/Demoscene
[DEFLATE]: https://en.wikipedia.org/wiki/Deflate
[Logistic context mixing]: https://en.wikipedia.org/wiki/Context_mixing#Logistic_Mixing
[rANS]: https://en.wikipedia.org/wiki/Asymmetric_numeral_systems#Range_variants_(rANS)_and_streaming
