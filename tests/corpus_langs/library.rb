require 'date'
require 'json'

# Lending books at a village library.
module Library
  LOAN_DAYS = 21
  FINE_PER_DAY = 0.25

  class Book
    attr_reader :title, :author
    attr_accessor :due

    def initialize(title, author)
      @title = title
      @author = author
      @due = nil
    end

    def on_loan?
      !@due.nil?
    end

    def to_s
      "#{title} by #{author}"
    end
  end

  class Desk
    def initialize
      @books = []
    end

    def add(book)
      @books << book
      self
    end

    def lend(title, today = Date.today)
      book = @books.find { |b| b.title == title && !b.on_loan? }
      raise ArgumentError, "#{title} is not available" unless book
      book.due = today + LOAN_DAYS
      book
    end

    def overdue(today = Date.today)
      @books.select { |b| b.on_loan? && b.due < today }
    end

    def fines(today = Date.today)
      overdue(today).sum { |b| (today - b.due).to_i * FINE_PER_DAY }
    end
  end
end

desk = Library::Desk.new
desk.add(Library::Book.new('Emma', 'Jane Austen'))
puts desk.lend('Emma').due
