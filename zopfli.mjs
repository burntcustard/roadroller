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
    constructor(packed) {
        this.input =
            packed.firstLine +
            packed.secondLine;

        this.sizes = new Map();

        // Only used if both candidates are still exactly tied
        // after Zopfli-128.
        this.fallback = packed.estimateLength();
    }

    sizeAt(iterations) {
        if (!this.sizes.has(iterations)) {
            this.sizes.set(iterations, zopfliDeflatedSize(this.input, iterations));
        }

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
     * Start cheaply at one iteration. If they produce exactly the
     * same compressed byte count, progressively increase the Zopfli
     * effort until one candidate pulls ahead:
     *
     *   1 → 2 → 4 → 8 → 16 → 32 → 64 → 128
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

        for (
            // 1, 4, 16, 64 (128 is handled by the fallback)
            let iterations = 1;
            iterations <= 64;
            iterations *= 4
        ) {
            const thisSize = this.sizeAt(iterations);

            const otherSize = other.sizeAt(iterations);

            if (thisSize !== otherSize) {
                return thisSize - otherSize;
            }
        }

        // Extremely unlikely, but if Zopfli still gives exactly
        // the same byte count at 128 iterations, use Roadroller's
        // existing estimate as a deterministic final tie-breaker.
        return this.fallback - other.fallback;
    }
}

export const createZopfliPackedScore = () =>
    packed => new AdaptiveZopfliScore(packed);
