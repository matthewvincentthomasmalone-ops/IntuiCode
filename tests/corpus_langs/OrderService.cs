using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Shop.Orders
{
    public enum OrderState { Open, Paid, Shipped, Cancelled }

    public interface IPaymentGateway
    {
        Task<bool> ChargeAsync(string customerId, decimal amount);
    }

    public class Order
    {
        public int Id { get; set; }
        public string CustomerId { get; set; } = "";
        public List<decimal> Lines { get; } = new List<decimal>();
        public OrderState State { get; private set; } = OrderState.Open;

        public decimal Total => Lines.Sum();

        public void MarkPaid() => State = OrderState.Paid;
    }

    public class OrderService
    {
        private readonly IPaymentGateway _gateway;
        private readonly List<Order> _orders = new List<Order>();

        public OrderService(IPaymentGateway gateway)
        {
            _gateway = gateway ?? throw new ArgumentNullException(nameof(gateway));
        }

        public async Task<bool> PayAsync(int orderId)
        {
            var order = _orders.FirstOrDefault(o => o.Id == orderId);
            if (order == null)
            {
                throw new KeyNotFoundException($"No order {orderId}");
            }
            var charged = await _gateway.ChargeAsync(order.CustomerId, order.Total);
            if (charged)
            {
                order.MarkPaid();
            }
            return charged;
        }

        public IEnumerable<Order> Unpaid() =>
            _orders.Where(o => o.State == OrderState.Open).OrderBy(o => o.Id);

        public void Add(Order order) => _orders.Add(order);
    }
}
