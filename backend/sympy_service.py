import sympy as sp
from sympy import symbols, diff, integrate, simplify, Eq, solve, limit, sin, exp, log, sqrt, oo, S
from sympy.parsing.latex import parse_latex
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application
import re
from typing import Optional, List, Dict, Any, Union

# Whitelist of allowed functions and constants
ALLOWED_FUNCTIONS = {
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
    'asin', 'acos', 'atan', 'acot', 'asec', 'acsc',
    'sinh', 'cosh', 'tanh', 'coth', 'sech', 'csch',
    'asinh', 'acosh', 'atanh',
    'exp', 'log', 'sqrt', 'abs',
    'pi', 'e', 'oo', 'I',
}

ALLOWED_CONSTANTS = {'pi': sp.pi, 'e': sp.E, 'oo': sp.oo, 'I': sp.I}

# Safe parsing transformations
SAFE_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)

class SymPyVerificationError(Exception):
    pass

# antlr4 (needed by sympy's parse_latex) is optional in this project. Track
# whether it actually loaded so we can skip it after the first failure instead
# of paying for a failed import on every step.
_LATEX_PARSER_AVAILABLE = True

_LATEX_FUNCTIONS = {
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
    'arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan',
    'sinh', 'cosh', 'tanh', 'coth', 'sech', 'csch',
    'asinh', 'acosh', 'atanh', 'exp', 'sqrt', 'abs', 'log', 'ln',
}


def latex_to_sympy_text(latex_str: str) -> str:
    """Convert the common handwritten-AI LaTeX subset to sympy_parser syntax.

    This is a deliberately small, whitelist-style converter. It exists because
    sympy's full ``parse_latex`` needs the optional antlr4 runtime, which this
    zero-budget project does not install. Unknown backslash commands are
    rejected instead of being silently dropped, so an unparsable step becomes
    "cannot verify" rather than a confidently wrong verdict.
    """
    text = latex_str.strip()
    text = re.sub(r'^\$+|\$+$', '', text)
    text = re.sub(
        r'\\(?:left|right|displaystyle|textstyle|,|!|;|:|quad|qquad|\s)',
        ' ',
        text,
    )
    text = re.sub(r'\\(?:text|mathrm|operatorname)\s*\{([^{}]*)\}', r' \1 ', text)

    # \frac{a}{b}; repeat to unwrap nested fractions from the inside out.
    for _ in range(12):
        new = re.sub(r'\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}', r'((\1)/(\2))', text)
        if new == text:
            break
        text = new

    # \sqrt[n]{x} and \sqrt{x}
    text = re.sub(r'\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}', r'((\2)**(1/(\1)))', text)
    text = re.sub(r'\\sqrt\s*\{([^{}]*)\}', r'sqrt(\1)', text)
    text = re.sub(r'\\sqrt\s*([A-Za-z0-9]+)', r'sqrt(\1)', text)

    for name in sorted(_LATEX_FUNCTIONS, key=len, reverse=True):
        if name == 'ln':
            continue
        # A function glued to a factor must become an explicit product:
        # 2x\cos(x) -> 2x*cos(x), otherwise sympy reads c*o*s.
        text = re.sub(
            r'(?<=[A-Za-z0-9)])' + re.escape('\\' + name), '*' + name, text
        )
        text = text.replace('\\' + name, name)
    text = text.replace('\\ln', 'log')
    text = text.replace('arcsin', 'asin').replace('arccos', 'acos').replace('arctan', 'atan')

    text = text.replace('\\cdot', '*').replace('\\times', '*').replace('\\div', '/')
    text = text.replace('\\pi', 'pi').replace('\\infty', 'oo')
    text = text.replace('\\le', '<=').replace('\\leq', '<=')
    text = text.replace('\\ge', '>=').replace('\\geq', '>=')
    text = text.replace('\\ne', '!=').replace('\\neq', '!=')

    # ^{...} needs parentheses before braces are dropped: e^{2x} -> e**(2x).
    text = re.sub(r'\^\s*\{([^{}]*)\}', r'**(\1)', text)
    text = text.replace('{', '').replace('}', '')
    text = text.replace('^', '**')
    text = text.replace('−', '-').replace('–', '-').replace('×', '*')
    text = text.replace('÷', '/').replace('·', '*')
    text = re.sub(r'\s+', ' ', text).strip()

    if '\\' in text:
        command = re.search(r'\\[A-Za-z]+', text)
        label = command.group(0) if command else "backslash"
        raise SymPyVerificationError(f"Unsupported LaTeX command: {label}")
    if not text:
        raise SymPyVerificationError("Empty LaTeX expression")
    return text


def parse_latex_safe(latex_str: str) -> sp.Expr:
    """Parse a LaTeX snippet safely, returning a SymPy expression.

    Prefers sympy's antlr parser when installed, then falls back to the
    whitelisted converter + sympy_parser. Raises SymPyVerificationError when
    neither route can parse the input.
    """
    global _LATEX_PARSER_AVAILABLE

    cleaned = latex_str.strip()
    cleaned = re.sub(r'\\left|\\right', '', cleaned)
    cleaned = re.sub(r'\\!|\\,|\\;', ' ', cleaned)

    latex_error: Optional[Exception] = None
    if _LATEX_PARSER_AVAILABLE:
        try:
            return parse_latex(cleaned)
        except ImportError as e:  # antlr4 runtime missing
            _LATEX_PARSER_AVAILABLE = False
            latex_error = e
        except Exception as e:
            latex_error = e

    try:
        plain = latex_to_sympy_text(cleaned)
        return parse_sympy_safe(plain)
    except SymPyVerificationError as fallback_error:
        raise SymPyVerificationError(
            f"Failed to parse LaTeX: {fallback_error}"
            + (f" (LaTeX parser: {latex_error})" if latex_error else "")
        )

def parse_sympy_safe(expr_str: str) -> sp.Expr:
    """Parse a plain math expression safely using sympy_parser."""
    try:
        # Convert ^ to ** for Python exponentiation
        expr_str = expr_str.replace('^', '**')
        expr = parse_expr(expr_str, transformations=SAFE_TRANSFORMATIONS, local_dict=ALLOWED_CONSTANTS)
        return expr
    except Exception as e:
        raise SymPyVerificationError(f"Failed to parse expression: {str(e)}")

def extract_variables(expr: sp.Expr) -> List[sp.Symbol]:
    """Extract free symbols from expression."""
    return list(expr.free_symbols)

def differentiate(expr: sp.Expr, var: sp.Symbol, order: int = 1) -> sp.Expr:
    """Compute derivative."""
    try:
        return diff(expr, var, order)
    except Exception as e:
        raise SymPyVerificationError(f"Differentiation failed: {str(e)}")

def integrate_expr(expr: sp.Expr, var: sp.Symbol, limits: Optional[tuple] = None) -> sp.Expr:
    """Compute indefinite or definite integral."""
    try:
        if limits:
            return integrate(expr, (var, limits[0], limits[1]))
        return integrate(expr, var)
    except Exception as e:
        raise SymPyVerificationError(f"Integration failed: {str(e)}")

def simplify_expr(expr: sp.Expr) -> sp.Expr:
    """Simplify expression."""
    try:
        return simplify(expr)
    except Exception as e:
        raise SymPyVerificationError(f"Simplification failed: {str(e)}")

def check_equivalence(expr1: sp.Expr, expr2: sp.Expr, var: Optional[sp.Symbol] = None) -> Dict[str, Any]:
    """Check if two expressions are equivalent."""
    try:
        diff_expr = simplify(expr1 - expr2)
        
        # Try direct simplification to 0
        if diff_expr == 0:
            return {"equivalent": True, "method": "direct", "confidence": 1.0}
        
        # Try simplify
        simplified = simplify(diff_expr)
        if simplified == 0:
            return {"equivalent": True, "method": "simplify", "confidence": 0.9}
        
        # Try numerical verification at random points (if variables present)
        if expr1.free_symbols or expr2.free_symbols:
            vars_list = list(expr1.free_symbols | expr2.free_symbols)
            import random
            all_zero = True
            for _ in range(10):
                test_vals = {v: random.uniform(-5, 5) for v in vars_list}
                try:
                    val1 = expr1.subs(test_vals).evalf()
                    val2 = expr2.subs(test_vals).evalf()
                    if abs(val1 - val2) > 1e-10:
                        all_zero = False
                        break
                except:
                    all_zero = False
                    break
            if all_zero:
                return {"equivalent": True, "method": "numerical", "confidence": 0.8}
        
        return {"equivalent": False, "method": "none", "confidence": 0.0}
    except Exception as e:
        return {"equivalent": False, "error": str(e), "confidence": 0.0}

def solve_equation(expr: sp.Expr, var: sp.Symbol) -> List[sp.Expr]:
    """Solve equation expr = 0 for var."""
    try:
        solutions = solve(expr, var, dict=True)
        return [sol[var] for sol in solutions if var in sol]
    except Exception as e:
        raise SymPyVerificationError(f"Solving failed: {str(e)}")

def compute_limit(expr: sp.Expr, var: sp.Symbol, point: Union[sp.Expr, float], dir: str = '+') -> sp.Expr:
    """Compute limit of expr as var approaches point."""
    try:
        return limit(expr, var, point, dir=dir)
    except Exception as e:
        raise SymPyVerificationError(f"Limit computation failed: {str(e)}")

def verify_step(user_step: str, expected_step: str, var_name: str = 'x') -> Dict[str, Any]:
    """Verify a single user step against expected step."""
    try:
        var = symbols(var_name)
        user_expr = parse_sympy_safe(user_step)
        expected_expr = parse_sympy_safe(expected_step)
        
        result = check_equivalence(user_expr, expected_expr, var)
        
        # Also check if user step is a valid intermediate form
        if not result["equivalent"]:
            # Check if it's a valid algebraic manipulation
            diff_expr = simplify(user_expr - expected_expr)
            result["difference"] = str(diff_expr)
            result["unsupported"] = False
        else:
            result["unsupported"] = False
            
        return result
    except SymPyVerificationError as e:
        return {"equivalent": False, "error": str(e), "unsupported": True, "confidence": 0.0}
    except Exception as e:
        return {"equivalent": False, "error": str(e), "unsupported": True, "confidence": 0.0}