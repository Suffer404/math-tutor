export interface Question {
  schema_version: string;
  id: string;
  course: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  question_type: string;
  question_text: string;
  question_latex?: string;
  source: {
    filename: string;
    page?: number;
    section?: string;
  };
  hints: string[];
  answer_latex: string;
  solution_steps: string[];
  verification_status: "pending" | "reviewed" | "verified";
  misconceptions?: string[];
  tags?: string[];
}

export const SAMPLE_QUESTIONS: Question[] = [
  {
    schema_version: "1.0",
    id: "q_calc_001",
    course: "Calculus I",
    topic: "Derivatives",
    difficulty: "easy",
    question_type: "differentiation",
    question_text: "Find the derivative of f(x) = x^3 - 4x + 7 with respect to x.",
    question_latex: "f(x) = x^3 - 4x + 7",
    source: {
      filename: "Calculus_Early_Transcendentals.pdf",
      page: 120,
      section: "3.1 Derivative of Polynomials"
    },
    hints: [
      "Use the power rule for each term: d/dx(x^n) = n*x^(n-1).",
      "The derivative of a constant like 7 is 0.",
      "Calculate 3*x^2 - 4."
    ],
    answer_latex: "f'(x) = 3x^2 - 4",
    solution_steps: [
      "d/dx(x^3) = 3x^2",
      "d/dx(-4x) = -4",
      "d/dx(7) = 0",
      "Combine terms: f'(x) = 3x^2 - 4"
    ],
    verification_status: "verified",
    tags: ["polynomial", "power-rule", "derivatives"]
  },
  {
    schema_version: "1.0",
    id: "q_calc_002",
    course: "Calculus I",
    topic: "Integration",
    difficulty: "medium",
    question_type: "integration",
    question_text: "Evaluate the indefinite integral: \\int (2x e^{x^2}) dx",
    question_latex: "\\int 2x e^{x^2} dx",
    source: {
      filename: "Calculus_Early_Transcendentals.pdf",
      page: 340,
      section: "5.5 Substitution Rule"
    },
    hints: [
      "Consider using u-substitution.",
      "Let u = x^2, then calculate du.",
      "du = 2x dx. Rewrite the integral in terms of u.",
      "Integrate e^u with respect to u, then substitute back u = x^2."
    ],
    answer_latex: "e^{x^2} + C",
    solution_steps: [
      "Let u = x^2",
      "du = 2x dx",
      "The integral becomes \\int e^u du",
      "\\int e^u du = e^u + C",
      "Substitute u = x^2: e^{x^2} + C"
    ],
    verification_status: "verified",
    tags: ["integration", "u-substitution", "exponential"]
  },
  {
    schema_version: "1.0",
    id: "q_calc_003",
    course: "Calculus II",
    topic: "Limits",
    difficulty: "medium",
    question_type: "limit",
    question_text: "Evaluate the limit: \\lim_{x \\to 0} \\frac{\\sin(5x)}{x}",
    question_latex: "\\lim_{x \\to 0} \\frac{\\sin(5x)}{x}",
    source: {
      filename: "Calculus_Early_Transcendentals.pdf",
      page: 95,
      section: "2.4 Limits Involving Trigonometric Functions"
    },
    hints: [
      "Recall the fundamental limit \\lim_{\\theta \\to 0} \\frac{\\sin\\theta}{\\theta} = 1.",
      "Multiply numerator and denominator by 5 to match the angle.",
      "Rewrite as 5 * \\lim_{x \\to 0} \\frac{\\sin(5x)}{5x}."
    ],
    answer_latex: "5",
    solution_steps: [
      "\\lim_{x \\to 0} \\frac{\\sin(5x)}{x} = \\lim_{x \\to 0} 5 \\cdot \\frac{\\sin(5x)}{5x}",
      "Let u = 5x. As x -> 0, u -> 0.",
      "5 \\cdot \\lim_{u \\to 0} \\frac{\\sin(u)}{u} = 5 \\cdot 1 = 5"
    ],
    verification_status: "verified",
    tags: ["limits", "trigonometry", "l-hopital"]
  }
];
