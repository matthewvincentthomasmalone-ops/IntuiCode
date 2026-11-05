package geometry

import scala.math.{Pi, sqrt}

trait Shape {
  def area: Double
  def name: String
}

case class Circle(radius: Double) extends Shape {
  def area: Double = Pi * radius * radius
  def name = "circle"
}

case class Rect(width: Double, height: Double) extends Shape {
  def area: Double = width * height
  def name = if (width == height) "square" else "rectangle"
}

case class Triangle(a: Double, b: Double, c: Double) extends Shape {
  require(a + b > c && a + c > b && b + c > a, "not a triangle")

  def area: Double = {
    val s = (a + b + c) / 2
    sqrt(s * (s - a) * (s - b) * (s - c))
  }
  def name = "triangle"
}

object Shapes {
  val Unit: Shape = Rect(1, 1)

  def largest(shapes: Seq[Shape]): Option[Shape] =
    if (shapes.isEmpty) None else Some(shapes.maxBy(_.area))

  def describe(shape: Shape): String = shape match {
    case Circle(r) if r < 1 => s"a small circle"
    case Circle(r)          => s"a circle of radius $r"
    case Rect(w, h)         => s"a ${w} by ${h} ${shape.name}"
    case t: Triangle        => s"a triangle with area ${t.area}"
  }

  def totalArea(shapes: Seq[Shape]): Double =
    shapes.map(_.area).sum

  def main(args: Array[String]): Unit = {
    val shapes = List(Circle(2), Rect(3, 4), Triangle(3, 4, 5), Unit)
    shapes.foreach(s => println(describe(s)))
    println(f"Total area: ${totalArea(shapes)}%.2f")
    largest(shapes).foreach(s => println(s"Largest: ${s.name}"))
  }
}
