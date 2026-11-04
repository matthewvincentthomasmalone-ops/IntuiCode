/**
 * @name Query built from request text
 * @description Building an SQL query by joining text from a web request
 *              lets an attacker change the query.
 * @kind problem
 * @problem.severity error
 * @id py/example-sql-from-request
 */

import python
import semmle.python.dataflow.new.DataFlow

/** A call that runs an SQL query, such as `cursor.execute(...)`. */
class SqlExecution extends DataFlow::CallCfgNode {
  SqlExecution() {
    this.getFunction().(DataFlow::AttrRead).getAttributeName() in ["execute", "executemany"]
  }

  DataFlow::Node getQuery() { result = this.getArg(0) }
}

/** Text that comes from the web request in a Flask view. */
predicate isRequestText(DataFlow::Node node) {
  exists(DataFlow::AttrRead read |
    read.getAttributeName() in ["args", "form", "values"] and
    node = read
  )
}

/** An expression that joins strings with `+` or `%`. */
predicate isJoinedText(Expr e) {
  e instanceof BinaryExpr and
  (
    e.(BinaryExpr).getOp() instanceof Add or
    e.(BinaryExpr).getOp() instanceof Mod
  )
}

from SqlExecution exec, DataFlow::Node source
where
  isRequestText(source) and
  isJoinedText(exec.getQuery().asExpr()) and
  DataFlow::localFlow(source, exec.getQuery())
select exec, "This query is built from $@.", source, "text from the request"
