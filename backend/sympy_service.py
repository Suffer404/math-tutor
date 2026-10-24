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

def parse_latex_safe(latex_str: str) -> sp.Expr:
    """Parse LaTeX string safely, return SymPy expression."""
    try:
        # Clean up common LaTeX artifacts
        cleaned = latex_str.strip()
        # Remove \left, \right
        cleaned = re.sub(r'\\left|\\right', '', cleaned)
        # Replace \cdot with *
        cleaned = cleaned.replace(r'\cdot', '*')
        # Replace \times with *
        cleaned = cleaned.replace(r'\times', '*')
        # Replace \frac with proper division (handled by parse_latex)
        
        expr = parse_latex(cleaned)
        return expr
    except Exception as e:
        raise SymPyVerificationError(f"Failed to parse LaTeX: {str(e)}")

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