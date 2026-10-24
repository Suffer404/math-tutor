# Calculus Question Bank Source

## Question: Derivative of Polynomial
**Course:** Calculus I
**Topic:** Derivatives
**Difficulty:** easy
**Type:** differentiation
**Source:** Calculus_Early_Transcendentals.pdf page 120 section 3.1

### Question Text
Find the derivative of f(x) = x^3 - 4x + 7 with respect to x.

### Question LaTeX
$$f(x) = x^3 - 4x + 7$$

### Hints
1. Use the power rule for each term: d/dx(x^n) = n*x^(n-1).
2. The derivative of a constant like 7 is 0.
3. Calculate 3*x^2 - 4.

### Answer
$$f'(x) = 3x^2 - 4$$

### Solution Steps
1. d/dx(x^3) = 3x^2
2. d/dx(-4x) = -4
3. d/dx(7) = 0
4. Combine terms: f'(x) = 3x^2 - 4

## Question: U-Substitution Integration
**Course:** Calculus I
**Topic:** Integration
**Difficulty:** medium
**Type:** integration
**Source:** Calculus_Early_Transcendentals.pdf page 340 section 5.5

### Question Text
Evaluate the indefinite integral: ∫ (2x e^(x^2)) dx

### Question LaTeX
$$\int 2x e^{x^2} dx$$

### Hints
1. Consider using u-substitution.
2. Let u = x^2, then calculate du.
3. du = 2x dx. Rewrite the integral in terms of u.
4. Integrate e^u with respect to u, then substitute back u = x^2.

### Answer
$$e^{x^2} + C$$

### Solution Steps
1. Let u = x^2
2. du = 2x dx
3. The integral becomes ∫ e^u du
4. ∫ e^u du = e^u + C
5. Substitute u = x^2: e^{x^2} + C

## Question: Trigonometric Limit
**Course:** Calculus II
**Topic:** Limits
**Difficulty:** medium
**Type:** limit
**Source:** Calculus_Early_Transcendentals.pdf page 95 section 2.4

### Question Text
Evaluate the limit: lim_{x→0} sin(5x)/x

### Question LaTeX
$$\lim_{x \to 0} \frac{\sin(5x)}{x}$$

### Hints
1. Recall the fundamental limit lim_{θ→0} sin(θ)/θ = 1.
2. Multiply numerator and denominator by 5 to match the angle.
3. Rewrite as 5 * lim_{x→0} sin(5x)/(5x).

### Answer
$$5$$

### Solution Steps
1. lim_{x→0} sin(5x)/x = lim_{x→0} 5 * sin(5x)/(5x)
2. Let u = 5x. As x → 0, u → 0.
3. 5 * lim_{u→0} sin(u)/u = 5 * 1 = 5