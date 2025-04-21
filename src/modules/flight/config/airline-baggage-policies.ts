/**
 * Airline-specific baggage policies for fallback when Amadeus doesn't provide details
 * References:
 * - SV (Saudia): https://www.saudia.com/experience/baggage-allowance
 * - MS (EgyptAir): https://www.egyptair.com/en/travel-info/baggage-information/checked-baggage
 * - XY (Flynas): https://www.flynas.com/en/plan-and-book/baggage-allowance
 * - NE (Nesma): https://www.nesmaairlines.com/travel-info/baggage-policy
 */

export interface BaggagePolicy {
  // Default checked baggage for the airline (if included with ticket)
  includedBaggage: {
    quantity: number;
    weightPerBag: number;
    weightUnit: 'KG' | 'LB';
  };

  // Cabin baggage allowance
  cabinBaggage: {
    weightInKg: number;
    quantity: number;
    description?: string;
  };

  // Purchasable baggage options
  additionalBaggage: Array<{
    type: 'CARRY_ON' | 'CHECKED';
    weightInKg: number;
    priceUSD: number; // Base price in USD, will be converted
    quantity: number;
  }>;

  // Route-specific overrides (for example, CAI-JED might have different baggage rules)
  routeSpecificPolicies?: {
    [routeKey: string]: {
      includedBaggage?: {
        quantity: number;
        weightPerBag: number;
        weightUnit: 'KG' | 'LB';
      };
      cabinBaggage?: {
        weightInKg: number;
        quantity: number;
        description?: string;
      };
      allowFareTypes?: boolean; // Whether to show fare types for this route
    };
  };
}

/**
 * Airline baggage policies defined by IATA carrier code
 */
export const AIRLINE_BAGGAGE_POLICIES: Record<string, BaggagePolicy> = {
  // Saudi Arabian Airlines (Saudia)
  SV: {
    includedBaggage: {
      quantity: 1,
      weightPerBag: 30,
      weightUnit: 'KG',
    },
    cabinBaggage: {
      weightInKg: 7,
      quantity: 1,
      description: '7 kg cabin baggage',
    },
    additionalBaggage: [
      { type: 'CHECKED', weightInKg: 23, priceUSD: 40, quantity: 1 },
      { type: 'CHECKED', weightInKg: 32, priceUSD: 60, quantity: 1 },
    ],
    routeSpecificPolicies: {
      'CAI-JED': {
        includedBaggage: {
          quantity: 1,
          weightPerBag: 30,
          weightUnit: 'KG',
        },
        cabinBaggage: {
          weightInKg: 7,
          quantity: 1,
          description: '7 kg cabin baggage',
        },
        allowFareTypes: true,
      },
    },
  },

  // EgyptAir
  MS: {
    includedBaggage: {
      quantity: 1,
      weightPerBag: 30,
      weightUnit: 'KG',
    },
    cabinBaggage: {
      weightInKg: 7,
      quantity: 1,
      description: '7 kg cabin baggage',
    },
    additionalBaggage: [
      { type: 'CHECKED', weightInKg: 23, priceUSD: 35, quantity: 1 },
      { type: 'CHECKED', weightInKg: 32, priceUSD: 50, quantity: 1 },
    ],
    routeSpecificPolicies: {
      'CAI-JED': {
        allowFareTypes: true,
      },
    },
  },

  // Flynas (Budget airline)
  XY: {
    includedBaggage: {
      quantity: 1,
      weightPerBag: 20,
      weightUnit: 'KG',
    },
    cabinBaggage: {
      weightInKg: 7,
      quantity: 1,
      description: '7 kg cabin baggage',
    },
    additionalBaggage: [
      { type: 'CHECKED', weightInKg: 20, priceUSD: 25, quantity: 1 },
      { type: 'CHECKED', weightInKg: 25, priceUSD: 35, quantity: 1 },
      { type: 'CHECKED', weightInKg: 30, priceUSD: 45, quantity: 1 },
    ],
    routeSpecificPolicies: {
      'CAI-JED': {
        includedBaggage: {
          quantity: 1,
          weightPerBag: 30,
          weightUnit: 'KG',
        },
        allowFareTypes: true,
      },
    },
  },

  // Nesma Airlines
  NE: {
    includedBaggage: {
      quantity: 1,
      weightPerBag: 30,
      weightUnit: 'KG',
    },
    cabinBaggage: {
      weightInKg: 7,
      quantity: 1,
      description: '7 kg cabin baggage',
    },
    additionalBaggage: [
      { type: 'CHECKED', weightInKg: 23, priceUSD: 30, quantity: 1 },
      { type: 'CHECKED', weightInKg: 32, priceUSD: 50, quantity: 1 },
    ],
    routeSpecificPolicies: {
      'CAI-JED': {
        allowFareTypes: true,
      },
    },
  },

  // Turkish Airlines
  TK: {
    includedBaggage: {
      quantity: 1,
      weightPerBag: 30,
      weightUnit: 'KG',
    },
    cabinBaggage: {
      weightInKg: 8,
      quantity: 1,
      description: '8 kg cabin baggage',
    },
    additionalBaggage: [
      { type: 'CHECKED', weightInKg: 23, priceUSD: 45, quantity: 1 },
      { type: 'CHECKED', weightInKg: 32, priceUSD: 65, quantity: 1 },
    ],
    routeSpecificPolicies: {
      'CAI-JED': {
        allowFareTypes: true,
      },
    },
  },
};

/**
 * Default baggage policy if no airline-specific policy is defined
 */
export const DEFAULT_BAGGAGE_POLICY: BaggagePolicy = {
  includedBaggage: {
    quantity: 1,
    weightPerBag: 23,
    weightUnit: 'KG',
  },
  cabinBaggage: {
    weightInKg: 7,
    quantity: 1,
    description: '7 kg cabin baggage',
  },
  additionalBaggage: [
    { type: 'CHECKED', weightInKg: 23, priceUSD: 30, quantity: 1 },
    { type: 'CHECKED', weightInKg: 32, priceUSD: 45, quantity: 1 },
  ],
};

/**
 * Helper function to get route key (e.g., CAI-JED)
 */
export function getRouteKey(
  departureAirport: string,
  arrivalAirport: string,
): string {
  return `${departureAirport}-${arrivalAirport}`;
}
