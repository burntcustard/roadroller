import zopfli from 'node-zopfli-es';

export const zopfliDeflatedSize = (input, numiterations = 1) => {
    return zopfli.deflateSync(
        input,
        {
            numiterations,
            blocksplitting: true,
            blocksplittinglast: false,
            blocksplittingmax: 5,
        }
    ).length;
};
    

class AdaptiveZopfliScore {
    constructor(input) {
        this.input = input;

        this.sizes = new Map();

        // Only used if both candidates are still exactly tied
        // after Zopfli-1000.
        this.fallback = Buffer.byteLength(input);
    }

    sizeAt(iterations) {
        if (!this.sizes.has(iterations)) {
            this.sizes.set(iterations, zopfliDeflatedSize(this.input, iterations));
        }

        return this.sizes.get(iterations);
    }

    // Read cached results for logging without triggering compression.
    cachedSizeAt(iterations) {
        return this.sizes.get(iterations);
    }

    /*
     * Used whenever Roadroller treats the score like a normal number,
     * e.g. simulated annealing:
     *
     *     currentSize - nextSize
     *
     * Those operations should stay cheap and use Zopfli-1 only.
     */
    valueOf() {
        return this.sizeAt(1);
    }

    /*
     * Compare two candidates.
     *
     * Start at one iteration. Candidates within 8 bytes are compared
     * at 100 iterations; candidates within 4 bytes there are compared at 1000.
     * Remaining ties use UTF-8 input length.
     *
     * Results are cached, so repeated comparisons don't rerun an
     * iteration count already calculated for that candidate.
     *
     * Returns:
     *
     *   < 0  this candidate is better
     *   > 0  other candidate is better
     *   = 0  completely tied
     */
    compare(other) {
        if (!other || typeof other.sizeAt !== 'function') {
            return Number(this) - Number(other);
        }

        if (this.input === other.input) {
            this.sizes = other.sizes;
            return 0;
        }

        const quickDiff = this.sizeAt(1) - other.sizeAt(1);
        // Trust the cheap result when candidates are more than 8 bytes apart.
        if (Math.abs(quickDiff) > 8) return quickDiff;

        const diff100 = this.sizeAt(100) - other.sizeAt(100);
        if (Math.abs(diff100) > 4) return diff100;

        // Within 4 bytes (inclusive) at 100 iterations, compare at 1000.
        const diff1000 = this.sizeAt(1000) - other.sizeAt(1000);
        if (diff1000) return diff1000;

        return this.fallback - other.fallback;
    }
}

export const createZopfliPackedScore = () =>
    input => new AdaptiveZopfliScore(input);
