import pytest
from backend.sympy_service import (
    parse_sympy_safe, differentiate, integrate_expr, simplify_expr,
    check_equivalence, solve_equation, compute_limit, verify_step,
    SymPyVerificationError
)
from sympy import symbols, sin, cos, exp, Rational

def test_parse_basic():
    x = symbols('x')
    expr = parse_sympy_safe("x**2 + 2*x + 1")
    assert expr == x**2 + 2*x + 1

def test_parse_with_functions():
    x = symbols('x')
    expr = parse_sympy_safe("sin(x) + cos(x)")
    assert expr.has(sin)
    assert expr.has(cos)
    
def test_differentiate():
    x = symbols('x')
    expr = x**3 - 4*x + 7
    result = differentiate(expr, x)
    assert result == 3*x**2 - 4

def test_integrate_indefinite():
    x = symbols('x')
    expr = 2*x*exp(x**2)
    result = integrate_expr(expr, x)
    assert result == exp(x**2)

def test_integrate_definite():
    x = symbols('x')
    expr = x**2
    result = integrate_expr(expr, x, limits=(0, 1))
    assert result == Rational(1, 3)

def test_simplify():
    x = symbols('x')
    expr = (x**2 - 1) / (x - 1)
    result = simplify_expr(expr)
    assert result == x + 1

def test_equivalence_true():
    x = symbols('x')
    expr1 = x**2 + 2*x + 1
    expr2 = (x + 1)**2
    result = check_equivalence(expr1, expr2, x)
    assert result["equivalent"] == True

def test_equivalence_false():
    x = symbols('x')
    expr1 = x**2
    expr2 = x + 1
    result = check_equivalence(expr1, expr2, x)
    assert result["equivalent"] == False

def test_solve():
    x = symbols('x')
    expr = x**2 - 4
    solutions = solve_equation(expr, x)
    assert set(solutions) == {-2, 2}

def test_limit():
    x = symbols('x')
    expr = sin(5*x) / x
    result = compute_limit(expr, x, 0)
    assert result == 5

def test_verify_step_correct():
    result = verify_step("3*x**2 - 4", "3*x**2 - 4", "x")
    assert result["equivalent"] == True
    assert result["confidence"] > 0.8

def test_verify_step_wrong():
    result = verify_step("3*x**2 - 5", "3*x**2 - 4", "x")
    assert result["equivalent"] == False

def test_verify_step_unsupported():
    result = verify_step("invalid syntax $$", "3*x**2 - 4", "x")
    assert result["unsupported"] == True

def test_derivative_of_sin():
    x = symbols('x')
    expr = sin(x)
    result = differentiate(expr, x)
    assert result == cos(x)

def test_limit_trig():
    x = symbols('x')
    expr = sin(3*x) / x
    result = compute_limit(expr, x, 0)
    assert result == 3

if __name__ == "__main__":
    pytest.main([__file__, "-v"])